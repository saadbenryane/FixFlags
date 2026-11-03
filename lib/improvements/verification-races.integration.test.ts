import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { reconcileImprovementVerification } from './verification'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('verification result custody under concurrent reconciliation', () => {
  let userId: string, projectId: string, sourceId: string, staleId: string, freshId: string, flagId: string, improvementId: string, attemptId: string
  const url = 'https://example.com/'
  const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
    checks: { 'viewport-missing': CHECK_REGISTRY['viewport-missing'].version }, outcomes: [], verificationTarget: null }
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'verification-race-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const project = await prisma.project.create({ data: { userId, name: 'Verification race', url, canonicalHost: 'example.com' } })
    projectId = project.id
    const source = await prisma.audit.create({ data: { userId, projectId, url, status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
    sourceId = source.id
    const flag = await prisma.flag.create({ data: { auditId: sourceId, source: 'DETERMINISTIC', checkId: 'viewport-missing',
      rubric: 'EXPERIENCE', severity: 'IMPORTANT', confidence: 1, position: 0, pageUrl: url,
      problem: 'Viewport metadata is missing', evidence: 'Controlled missing viewport observation',
      whyItMatters: 'The page needs responsive viewport configuration', fix: 'Add the viewport declaration' } })
    flagId = flag.id
    const improvement = await prisma.improvement.create({ data: { projectId, fingerprint: 'check:viewport-missing',
      title: flag.problem, judgment: flag.evidence, expectedBenefit: flag.whyItMatters,
      recommendedChange: flag.fix, successCondition: 'Viewport metadata is present',
      occurrences: { create: { auditId: sourceId, flagId, kind: 'CONFIRMED' } } } })
    improvementId = improvement.id
    const attempt = await prisma.improvementAttempt.create({ data: { improvementId, sourceAuditId: sourceId,
      builder: 'fixture', handoffReference: 'flag:' + flagId, frozen: true, createdAt: new Date(Date.now() - 60_000) } })
    attemptId = attempt.id
    const children = []
    for (const present of [false, true]) {
      const child = await prisma.audit.create({ data: { userId, projectId, parentId: sourceId, url, status: 'COMPLETED',
        startedAt: new Date(), completedAt: new Date(), executionSpec: spec, reportCompleteness: 'PARTIAL' } })
      children.push(child.id)
      if (present) await prisma.auditVerificationReceipt.create({ data: { auditId: child.id, targetKey: 'module:metadata',
        scopeKey: 'page:' + url, source: 'DETERMINISTIC', status: 'COMPLETED', pageUrl: url, detail: {
          kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: url, applicable: true, passed: true, complete: true,
          assertions: [{ key: 'viewport-presence', name: 'Viewport', expected: 'Present', observed: 'Controlled present viewport observation', passed: true, complete: true }],
          execution: { auditId: child.id, taskId: 'controlled-viewport', checkVersion: spec.checks['viewport-missing'],
            source: 'rendered-dom', collectedAt: new Date().toISOString() },
        } } })
    }
    staleId = children[0]; freshId = children[1]
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  async function pauseReconciliation(recovered = false) {
    let release!: () => void, entered!: () => void
    const paused = new Promise<void>(resolve => { entered = resolve })
    const resumed = new Promise<void>(resolve => { release = resolve })
    if (recovered) {
      const read = prisma.improvementAttempt.findMany.bind(prisma.improvementAttempt)
      vi.spyOn(prisma.improvementAttempt, 'findMany').mockImplementationOnce(async args => {
        const rows = await read(args); entered(); await resumed; return rows
      })
    } else {
      const read = prisma.improvementOccurrence.findMany.bind(prisma.improvementOccurrence)
      vi.spyOn(prisma.improvementOccurrence, 'findMany').mockImplementationOnce(async args => {
        const rows = await read(args); entered(); await resumed; return rows
      })
    }
    const result = reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: staleId })
    await paused
    return { release, result }
  }

  it.each([false, true])('recovers every comparable historical capture beyond the first batch while preserving gaps: %s', async withGaps => {
    const target = { kind: 'DIAGNOSTIC', pageUrl: url, checkId: 'viewport-missing', parentAuditId: sourceId, attemptId }
    const executionSpec = { ...spec, scope: 'DIAGNOSTIC', verificationTarget: target }
    await prisma.audit.update({ where: { id: freshId }, data: { executionSpec } })
    await prisma.runRequest.create({ data: { projectId, auditId: freshId, requestedByUserId: userId, source: 'WEB',
      idempotencyKey: 'historical-repair', status: 'COMPLETED', verificationTarget: target, executionSpec } })
    const origin = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const history = Array.from({ length: 320 }, (_, index) => ({ id: `history-${String(index).padStart(4, '0')}-${sourceId}`,
      observedAt: new Date(Date.now() - 3 * 86400_000 + index * 300_000),
      pageUrl: withGaps && (index < 120 || index === 250) ? url + 'unobserved' : url }))
    await prisma.audit.createMany({ data: history.map(row => ({ id: row.id, userId, projectId, url: row.pageUrl,
      createdAt: row.observedAt, startedAt: row.observedAt, completedAt: row.observedAt, status: 'COMPLETED', executionSpec: spec })) })
    await prisma.flag.createMany({ data: history.map(row => ({ id: row.id, auditId: row.id, checkId: origin.checkId,
      source: 'DETERMINISTIC', rubric: origin.rubric, severity: origin.severity, confidence: 1, position: 0,
      pageUrl: row.pageUrl, createdAt: row.observedAt, problem: origin.problem, evidence: 'Controlled earlier viewport absence',
      whyItMatters: origin.whyItMatters, fix: origin.fix })) })
    await prisma.improvementOccurrence.createMany({ data: history.map(row => ({ improvementId, auditId: row.id, flagId: row.id,
      kind: 'CONFIRMED', createdAt: row.observedAt })) })
    let laterFlagId: string | undefined
    if (withGaps) {
      const later = await prisma.audit.create({ data: { userId, projectId, url, status: 'COMPLETED', completedAt: new Date(), executionSpec: spec } })
      const flag = await prisma.flag.create({ data: { auditId: later.id, checkId: origin.checkId, source: 'DETERMINISTIC',
        rubric: origin.rubric, severity: origin.severity, confidence: 1, position: 0, pageUrl: url,
        problem: origin.problem, evidence: 'Controlled observation after verification began', whyItMatters: origin.whyItMatters, fix: origin.fix } })
      laterFlagId = flag.id
      await prisma.improvementOccurrence.create({ data: { improvementId, auditId: later.id, flagId: flag.id, kind: 'CONFIRMED' } })
    }
    const results = await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })
    expect(results).toEqual([expect.objectContaining({ attemptId, outcome: 'IMPROVED', comparable: true })])
    const rows = await prisma.flag.findMany({ where: { id: { in: history.map(row => row.id) } }, orderBy: { id: 'asc' } })
    expect(rows.filter(row => row.status === 'FIXED')).toHaveLength(withGaps ? 199 : 320)
    for (const row of rows) expect(row).toMatchObject(row.pageUrl === url ? { status: 'FIXED', resolvedInId: freshId } : { status: 'OPEN', resolvedInId: null })
    if (laterFlagId) expect(await prisma.flag.findUniqueOrThrow({ where: { id: laterFlagId } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toMatchObject({ status: withGaps ? 'PROPOSED' : 'VERIFIED' })
    const settled = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })).toEqual([])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(settled)
  })

  it.each(['pending', 'inconclusive'] as const)('preserves a committed recovery when an older %s snapshot resumes', async kind => {
    if (kind === 'inconclusive') {
      await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { outcome: 'INCONCLUSIVE', verificationAuditId: staleId } })
      await prisma.flag.update({ where: { id: flagId }, data: { status: 'FIXED', resolvedInId: staleId } })
    }
    const stale = await pauseReconciliation(kind === 'inconclusive')
    let before, staleResults
    try {
      await prisma.flag.update({ where: { id: flagId }, data: { status: 'FIXED', resolvedInId: freshId } })
      const results = await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })
      expect(results).toEqual([expect.objectContaining({ attemptId, outcome: 'IMPROVED', comparable: true })])
      before = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
      expect(before).toMatchObject({ verificationAuditId: freshId, outcome: 'IMPROVED' })
    } finally { stale.release(); staleResults = await stale.result }
    expect(staleResults).toEqual([])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(before)
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toMatchObject({ status: 'VERIFIED' })
    expect(await prisma.improvementCycleEvent.count({ where: { verificationAuditId: staleId } })).toBe(0)
  })

  it.each(['rejected', 'superseded', 'reassigned'] as const)('refuses an assessed snapshot after the repair is %s', async change => {
    const stale = await pauseReconciliation()
    let before, staleResults
    try {
      if (change === 'rejected' || change === 'superseded') await prisma.improvement.update({ where: { id: improvementId },
        data: { status: change === 'rejected' ? 'REJECTED' : 'SUPERSEDED' } })
      if (change === 'reassigned') await prisma.improvementAttempt.update({ where: { id: attemptId }, data: { verificationAuditId: freshId } })
      before = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    } finally { stale.release(); staleResults = await stale.result }
    expect(staleResults).toEqual([])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(before)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
    if (change === 'rejected' || change === 'superseded') expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } }))
      .toMatchObject({ status: change === 'rejected' ? 'REJECTED' : 'SUPERSEDED' })
    expect(await prisma.improvementCycleEvent.count({ where: { verificationAuditId: staleId } })).toBe(0)
  })
})
