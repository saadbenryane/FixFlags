import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'
import { reconcileImprovementVerification } from './verification'
import { materializeAttentionForAudit } from './occurrences'
import * as execution from '@/lib/audit/execution-ownership'
import { lockImprovementLedger } from './ledger-lock'
import { requireSiteFlagAttempt } from '@/lib/sites/application/flag-verification'
import { getOwnedRun } from '@/lib/sites/application/run-queries'
import { loadMonitoringHistory } from '@/lib/sites/application/monitoring-history'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'

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

  async function targetedRecovery(idempotencyKey: string) {
    const target = { kind: 'DIAGNOSTIC', pageUrl: url, checkId: 'viewport-missing', parentAuditId: sourceId, attemptId }
    const executionSpec = { ...spec, scope: 'DIAGNOSTIC', verificationTarget: target }
    await prisma.audit.update({ where: { id: freshId }, data: { executionSpec } })
    await prisma.runRequest.create({ data: { projectId, auditId: freshId, requestedByUserId: userId, source: 'WEB',
      idempotencyKey, status: 'COMPLETED', verificationTarget: target, executionSpec } })
  }

  async function waitForLedgerWaiter(site = false) {
    await vi.waitFor(async () => {
      const rows = await prisma.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
        SELECT 1 FROM pg_locks lock JOIN pg_stat_activity activity ON activity.pid = lock.pid
        WHERE activity.datname = current_database() AND NOT lock.granted
          AND (${site} AND activity.query LIKE '%"projects"%' OR NOT ${site} AND lock.locktype = 'advisory')
      ) AS waiting`
      expect(rows[0].waiting).toBe(true)
    }, { timeout: 3000 })
  }

  async function sameAuditPeer() {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const peer = await prisma.flag.create({ data: {
      auditId: sourceId, source: original.source, checkId: original.checkId, rubric: original.rubric, severity: original.severity,
      confidence: 1, position: 1, pageUrl: url + 'other', problem: original.problem, evidence: 'Independent second capture',
      whyItMatters: original.whyItMatters, fix: original.fix,
    } })
    await prisma.improvementOccurrence.create({ data: { auditId: sourceId, improvementId, flagId: peer.id, kind: 'CONFIRMED' } })
    const read = prisma.improvementOccurrence.findMany.bind(prisma.improvementOccurrence)
    vi.spyOn(prisma.improvementOccurrence, 'findMany').mockImplementation(args => read({ ...args, orderBy: { flag: { position: 'asc' } } }))
    return peer
  }

  async function recordCaptureAttempt(handoffReference: string | null, sourceFlagIds: string[] = []) {
    const attempt = await prisma.improvementAttempt.create({ data: { improvementId, sourceAuditId: sourceId, builder: 'fixture',
      handoffReference, sourceFlagIds, frozen: true, createdAt: new Date(Date.now() - 30_000) } })
    attemptId = attempt.id
    return attempt
  }

  async function freshFinding(position: number, options: { pageUrl?: string; context?: string; regressed?: boolean } = {}) {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    return prisma.flag.create({ data: { auditId: freshId, checkId: original.checkId, source: original.source,
      rubric: original.rubric, impactTag: original.impactTag, severity: original.severity, confidence: 1,
      problem: original.problem, evidence: 'Fresh observation', whyItMatters: original.whyItMatters, fix: original.fix,
      pageUrl: options.pageUrl ?? url, position, status: options.regressed ? 'REGRESSED' : 'OPEN',
      ...(options.context ? { evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: 'Page', context: options.context }] } : {}),
    } })
  }

  it.each(['exact', 'different page', 'different condition', 'ambiguous', 'changed before settlement'] as const)(
    'keeps failed-verifier evidence scoped when the fresh Flag is %s', async scenario => {
      await targetedRecovery('still-failing')
      const existing = await prisma.auditVerificationReceipt.findFirstOrThrow({ where: { auditId: freshId, targetKey: 'module:metadata' } })
      await prisma.auditVerificationReceipt.update({ where: { id: existing.id }, data: { detail: {
        kind: 'site-module-check', version: 1, module: 'metadata', pageUrl: url, applicable: true, passed: false, complete: true,
        assertions: [{ key: 'viewport-presence', name: 'Viewport', expected: 'Present', observed: 'Still absent', passed: false, complete: true }],
        execution: { auditId: freshId, taskId: 'controlled-viewport', checkVersion: spec.checks['viewport-missing'],
          source: 'rendered-dom', collectedAt: new Date().toISOString() },
      } } })
      const exact = scenario === 'exact' || scenario === 'ambiguous' ? await freshFinding(0) : null
      const other = await freshFinding(1, {
        pageUrl: scenario === 'different page' || scenario === 'exact' ? url + 'other' : url,
        context: scenario === 'different condition' ? 'observed-after-another-interaction' : undefined, regressed: true,
      })
      const read = prisma.flag.findMany.bind(prisma.flag)
      vi.spyOn(prisma.flag, 'findMany').mockImplementation(args => read(args?.where?.auditId === freshId ? { ...args, orderBy: { position: 'asc' } } : args))
      if (scenario === 'changed before settlement') {
        const transaction = execution.executionTransaction
        vi.spyOn(execution, 'executionTransaction').mockImplementationOnce((work, options) => transaction(async tx => {
          await tx.flag.update({ where: { id: other.id }, data: { pageUrl: url + 'other' } })
          return work(tx)
        }, options))
      }

      expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId }))
        .toEqual([expect.objectContaining({ attemptId, outcome: 'UNCHANGED', comparable: true })])
      const expected = scenario === 'exact' ? exact!.id : null
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
        evidenceReference: { beforeFlagId: flagId, afterAuditId: freshId, afterFlagId: expected },
      })
      expect(await prisma.improvementOccurrence.findUnique({ where: { flagId: other.id } })).toBeNull()
      if (expected) expect(await prisma.improvementOccurrence.findUnique({ where: { flagId: expected } }))
        .toMatchObject({ improvementId, kind: 'CONFIRMED' })
    },
  )

  it('keeps a historical verification without a verdict inconclusive when only a sibling page is flagged', async () => {
    await targetedRecovery('legacy-sibling-failure')
    await prisma.audit.update({ where: { id: freshId }, data: { executionSpec: Prisma.DbNull, reportCompleteness: 'FULL',
      evidenceCoverage: { desktopScreenshot: true, metadata: true } } })
    await prisma.auditPage.create({ data: { auditId: freshId, url, normalizedUrl: url, role: 'primary', position: 0, status: 'COMPLETED' } })
    await prisma.auditVerificationReceipt.create({ data: { auditId: freshId, targetKey: 'check:viewport-missing',
      scopeKey: 'page:https://example.com', source: 'DETERMINISTIC', status: 'COMPLETED', evidenceReference: { historical: true } } })
    const sibling = await freshFinding(0, { pageUrl: url + 'other', regressed: true })
    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId }))
      .toEqual([expect.objectContaining({ attemptId, outcome: 'INCONCLUSIVE', comparable: false })])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      verificationCoverage: { evidenceComparable: false, verifierExecuted: true }, evidenceReference: { afterFlagId: null },
    })
    expect(await prisma.improvementOccurrence.findUnique({ where: { flagId: sibling.id } })).toBeNull()
  })

  it('keeps a second capture inconclusive when the same Audit only proved its sibling page', async () => {
    const peer = await sameAuditPeer()
    await recordCaptureAttempt('flag:' + peer.id)
    const target = { kind: 'DIAGNOSTIC', pageUrl: peer.pageUrl!, checkId: peer.checkId!, parentAuditId: sourceId, attemptId }
    const executionSpec = { ...spec, scope: 'DIAGNOSTIC', verificationTarget: target }
    await prisma.audit.update({ where: { id: freshId }, data: { executionSpec } })
    await prisma.runRequest.create({ data: { projectId, auditId: freshId, source: 'WEB', idempotencyKey: 'second-diagnostic-capture',
      status: 'COMPLETED', verificationTarget: target, executionSpec } })

    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId }))
      .toEqual([expect.objectContaining({ attemptId, outcome: 'INCONCLUSIVE', comparable: false })])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      evidenceReference: { beforeAuditId: sourceId, beforeFlagId: peer.id, afterAuditId: freshId, afterFlagId: null },
    })
    for (const id of [flagId, peer.id]) expect(await prisma.flag.findUniqueOrThrow({ where: { id } }))
      .toMatchObject({ status: 'OPEN', resolvedInId: null })
  })

  it.each([
    { state: 'CLEAR', source: 'original', comparable: true, verdict: 'IMPROVED', result: 'CLEAR' },
    { state: 'FLAG', source: 'original', comparable: true, verdict: 'UNCHANGED', result: 'FLAG' },
    { state: 'CLEAR', source: 'changed-scope', comparable: false, verdict: 'INCONCLUSIVE', result: 'COULD_NOT_VERIFY' },
    { state: 'CLEAR', source: 'different-flag', comparable: false, verdict: 'INCONCLUSIVE', result: 'COULD_NOT_VERIFY' },
  ] as const)('projects the recorded repair verdict $verdict alongside a $state observation and $source source', async ({ state, source, comparable, verdict, result }) => {
    const peer = await sameAuditPeer()
    const outcome = await prisma.siteOutcome.create({ data: { projectId, name: 'Page responds', slug: 'page-responds', kind: 'AVAILABILITY' } })
    await prisma.improvement.update({ where: { id: improvementId }, data: { outcomeId: outcome.id } })
    await recordCaptureAttempt('flag:' + peer.id, [peer.id])
    const target = { kind: 'OUTCOME', outcomeId: outcome.id, parentAuditId: sourceId, attemptId }
    const binding = { key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: url }, required: true }
    const executionSpec = { ...spec, scope: 'OUTCOMES', checks: {}, verificationTarget: target,
      outcomes: [{ id: outcome.id, kind: 'AVAILABILITY', expectation: null, bindingPolicy: 'ALL_REQUIRED', bindings: [binding] }] }
    await prisma.audit.update({ where: { id: freshId }, data: { executionSpec } })
    const before = await prisma.runRequest.create({ data: { projectId, auditId: sourceId, source: 'WATCH',
      idempotencyKey: 'original-outcome', status: 'COMPLETED', selections: { create: { outcomeId: outcome.id } } } })
    const after = await prisma.runRequest.create({ data: { projectId, auditId: freshId, source: 'WEB', idempotencyKey: 'second-outcome-capture',
      status: 'COMPLETED', verificationTarget: target, executionSpec, selections: { create: { outcomeId: outcome.id } } } })
    const coverage = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
      bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: url }, evaluator: DEFAULT_AVAILABILITY_EVALUATOR }] }
    const originalCoverage = source !== 'changed-scope' ? coverage : { ...coverage, bindings: [
      { ...coverage.bindings[0], config: { startUrl: url + 'original' } },
    ] }
    const validUntil = new Date(Date.now() + 60_000)
    const matching = await freshFinding(0)
    const unrelated = await freshFinding(1, { regressed: true })
    const recordedSourceId = source === 'different-flag' ? flagId : peer.id
    await prisma.outcomeAssessment.createMany({ data: [
      { outcomeId: outcome.id, runRequestId: before.id, auditId: sourceId, state: 'FLAG',
        summary: 'Unavailable', coverage: originalCoverage, evidence: { reason: 'http_unavailable',
          incident: { version: 1, transition: 'failure', incidentRunRequestId: before.id, rootFlagIds: [recordedSourceId],
            flagIds: [recordedSourceId], recoveredFlagIds: [], previousAssessmentId: null } }, validUntil },
      { outcomeId: outcome.id, runRequestId: after.id, auditId: freshId, state,
        summary: 'Recorded result', coverage, evidence: state === 'CLEAR' ? { reason: 'available' } : { reason: 'http_unavailable',
          incident: { version: 1, transition: 'failure', incidentRunRequestId: after.id, rootFlagIds: [matching.id],
            flagIds: [matching.id], recoveredFlagIds: [], previousAssessmentId: null } }, validUntil },
    ] })

    const site = (await loadSiteRecord(projectId))!
    expect(await getOwnedRun(userId, after.id)).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL',
      outcomes: [{ outcomeId: outcome.id, result: state }] })
    expect((await loadMonitoringHistory(site)).timeline.find(item => item.id === freshId)).toMatchObject({
      afterFix: true, result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL',
    })
    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId }))
      .toEqual([expect.objectContaining({ attemptId, outcome: verdict,
        comparable, status: verdict === 'IMPROVED' ? 'PROPOSED' : 'UNVERIFIED' })])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toMatchObject({
      evidenceReference: { beforeAuditId: sourceId, beforeFlagId: peer.id, beforeFlagIds: [peer.id],
        afterAuditId: freshId, afterFlagId: state === 'FLAG' ? matching.id : null },
    })
    expect(await getOwnedRun(userId, after.id)).toMatchObject({ result, validUntil: validUntil.toISOString(),
      completionState: comparable ? 'FULL' : 'PARTIAL', outcomes: [{ outcomeId: outcome.id, result: state }] })
    expect((await loadMonitoringHistory(site)).timeline.find(item => item.id === freshId)).toMatchObject({
      afterFix: true, result, completionState: comparable ? 'COMPLETED' : 'PARTIAL',
    })
    if (comparable) {
      await prisma.outcomeAssessment.update({ where: { runRequestId_outcomeId: { runRequestId: after.id, outcomeId: outcome.id } },
        data: { validUntil: new Date(Date.now() - 60_000) } })
      expect(await getOwnedRun(userId, after.id)).toMatchObject({ result: 'STALE', completionState: 'FULL' })
      expect((await loadMonitoringHistory(site)).timeline.find(item => item.id === freshId)).toMatchObject({ result })
    }
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: peer.id } })).toMatchObject(verdict === 'IMPROVED'
      ? { status: 'FIXED', resolvedInId: freshId } : { status: 'OPEN', resolvedInId: null })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
    expect(await prisma.improvementOccurrence.findUnique({ where: { flagId: unrelated.id } })).toBeNull()
  })

  it('keeps an ambiguous legacy attempt without a source reference unresolved', async () => {
    const original = await recordCaptureAttempt(null)
    const request = { siteId: projectId, flagId, userId, attemptId }
    await expect(requireSiteFlagAttempt(request)).resolves.toMatchObject({ attemptId })
    await sameAuditPeer()
    await expect(requireSiteFlagAttempt(request)).rejects.toMatchObject({ status: 409 })
    await targetedRecovery('ambiguous-legacy-source')
    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })).toEqual([])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(original)
  })

  it('drops an assessed source when a mutable repair draft changes its Flag before settlement', async () => {
    const peer = await sameAuditPeer()
    const draft = await prisma.improvementAttempt.create({ data: { improvementId, sourceAuditId: sourceId, builder: 'fixture',
      handoffReference: 'flag:' + flagId, frozen: false, createdAt: new Date(Date.now() - 30_000) } })
    const stale = await pauseReconciliation()
    let revised, results
    try {
      revised = await prisma.improvementAttempt.update({ where: { id: draft.id }, data: {
        handoffReference: 'flag:' + peer.id, sourceFlagIds: [peer.id],
      } })
    } finally { stale.release(); results = await stale.result }
    expect(results.some(result => result.attemptId === draft.id)).toBe(false)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: draft.id } })).toEqual(revised)
  })

  it('preserves independent recovery when an older source projection resumes', async () => {
    await targetedRecovery('projection-recovery-race')
    let release!: () => void, captured = false
    const resumed = new Promise<void>(resolve => { release = resolve })
    const read = prisma.audit.findUnique.bind(prisma.audit)
    vi.spyOn(prisma.audit, 'findUnique').mockImplementationOnce(async args => {
      const row = await read(args); captured = true; await resumed; return row
    })
    const projection = materializeAttentionForAudit(sourceId)
    let recovered
    try {
      await vi.waitFor(() => expect(captured).toBe(true), { timeout: 3000 })
      expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId }))
        .toEqual([expect.objectContaining({ attemptId, outcome: 'IMPROVED', comparable: true })])
      recovered = await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })
      expect(recovered.status).toBe('VERIFIED')
    } finally { release(); await projection }
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toEqual(recovered)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'FIXED', resolvedInId: freshId })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } }))
      .toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: freshId })
  })

  it('waits for a committing verification before projecting current source facts without a lock retry', async () => {
    await targetedRecovery('held-projection-recovery-race')
    let release!: () => void, entered = 0
    const resumed = new Promise<void>(resolve => { release = resolve })
    const transaction = execution.executionTransaction
    vi.spyOn(execution, 'executionTransaction').mockImplementationOnce((work, options) => transaction(async tx => {
      await lockImprovementLedger(tx, improvementId)
      entered++
      await resumed
      return work(tx)
    }, options))
    const verification = reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })
    let projection: Promise<void> | undefined
    try {
      await vi.waitFor(() => expect(entered).toBe(1), { timeout: 3000 })
      projection = materializeAttentionForAudit(sourceId)
      await waitForLedgerWaiter()
    } finally { release(); await Promise.all([verification, projection]) }
    expect(entered).toBe(1)
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toMatchObject({ status: 'VERIFIED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'FIXED', resolvedInId: freshId })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } }))
      .toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: freshId })
  })

  it('commits independent recovery after an already active source projection without a lock retry', async () => {
    await targetedRecovery('held-source-projection-race')
    let release!: () => void, entered = 0
    const resumed = new Promise<void>(resolve => { release = resolve })
    const transaction = execution.executionTransaction
    vi.spyOn(execution, 'executionTransaction').mockImplementationOnce((work, options) => transaction(async tx => {
      const result = await work(tx)
      entered++
      await resumed
      return result
    }, options))
    const projection = materializeAttentionForAudit(sourceId)
    let verification: ReturnType<typeof reconcileImprovementVerification> | undefined
    try {
      await vi.waitFor(() => expect(entered).toBe(1), { timeout: 3000 })
      verification = reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })
      await waitForLedgerWaiter(true)
    } finally { release(); await Promise.all([projection, verification]) }
    expect(entered).toBe(1)
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toMatchObject({ status: 'VERIFIED' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'FIXED', resolvedInId: freshId })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } }))
      .toMatchObject({ outcome: 'IMPROVED', comparable: true, verificationAuditId: freshId })
  })

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

  it('keeps repair evidence within its Site during selection and commit', async () => {
    const before = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    const foreign = await prisma.project.create({ data: { userId, name: 'Separate Site',
      canonicalHost: 'other.example.com', url: 'https://other.example.com/' } })
    const stale = await pauseReconciliation()
    try {
      await prisma.audit.update({ where: { id: sourceId }, data: { projectId: foreign.id } })
      expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: freshId })).toEqual([])
    } finally { stale.release(); await stale.result }
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(before)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN', resolvedInId: null })
    expect(await prisma.improvementCycleEvent.count({ where: { attemptId } })).toBe(0)
  })
})
