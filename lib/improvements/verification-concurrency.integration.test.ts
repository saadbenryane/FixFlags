import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { materializeAttentionForAudit } from './occurrences'
import { reconcileImprovementVerification } from './verification'
import { diffFlagsAgainstParent, getFlagDiffSummary, persistFlagDiffSummary } from '@/lib/audit/diff-flags'
import * as ownership from '@/lib/audit/execution-ownership'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('concurrent independent repair result publication in PostgreSQL', () => {
  let userId: string, projectId: string, sourceId: string, attemptId: string, improvementId: string
  const pageUrl = 'https://example.com/'
  const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl,
    environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null }
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'repair-race-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const site = await prisma.project.create({ data: { userId, name: 'Controlled repair result race',
      url: pageUrl, canonicalHost: 'example.com', notificationLevel: 'OFF' } })
    projectId = site.id
    const now = new Date(), before = new Date(now.getTime() - 10_000)
    const source = await prisma.audit.create({ data: { userId, projectId, url: pageUrl,
      status: 'COMPLETED', createdAt: before, startedAt: before, completedAt: before, executionSpec: spec,
      flags: { create: { source: 'DETERMINISTIC', checkId: 'no-https', rubric: 'TRUST', severity: 'IMPORTANT',
        pageUrl, problem: 'The recorded page used HTTP', evidence: 'Controlled saved transport observation',
        whyItMatters: 'Transport was insecure', fix: 'Serve the same page through HTTPS', confidence: 1, position: 0 } } } })
    sourceId = source.id
    await materializeAttentionForAudit(sourceId)
    const improvement = await prisma.improvement.findFirstOrThrow({ where: { projectId } })
    improvementId = improvement.id
    const attempt = await prisma.improvementAttempt.create({ data: { improvementId, sourceAuditId: sourceId,
      builder: 'copy', changeSummary: 'Enable HTTPS for the recorded page', createdAt: new Date(now.getTime() - 5000) } })
    attemptId = attempt.id
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  // Saved observations isolate result publication and SQL concurrency. These
  // fixtures do not establish that either run visited a website or deployed a fix.
  async function observed(passed: boolean | null) {
    const time = new Date()
    const audit = await prisma.audit.create({ data: { userId, projectId, parentId: sourceId, url: pageUrl,
      status: 'COMPLETED', startedAt: time, completedAt: time, reportCompleteness: 'PARTIAL', executionSpec: spec } })
    if (passed !== null) await prisma.auditVerifierExecution.create({ data: { auditId: audit.id, targetKey: 'module:security',
      scopeKey: 'page:' + pageUrl, pageUrl, source: 'DETERMINISTIC', status: 'COMPLETED', detail: {
        kind: 'site-module-check', version: 1, module: 'security', pageUrl, applicable: true, complete: true, passed,
        assertions: [{ key: 'https', name: 'HTTPS', expected: 'HTTPS', observed: passed ? 'HTTPS' : 'HTTP', passed, complete: true }],
        execution: { auditId: audit.id, taskId: 'observed-http', checkVersion: 1, source: 'http', collectedAt: time.toISOString() },
      } } })
    return audit.id
  }

  it.each([true, false])('retains a conclusive %s result when an opposing prepared result resumes later', async passed => {
    const laggingId = await observed(!passed), firstId = await observed(passed)
    let release!: () => void, selected!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const prepared = new Promise<void>(resolve => { selected = resolve })
    const transact = ownership.executionTransaction
    let firstTransaction = true
    const delayed = vi.spyOn(ownership, 'executionTransaction').mockImplementation((write, options) => transact(async tx => {
      // Preparation has selected the pending attempt and its independent
      // observation. Delay only publication before its Improvement lock.
      if (firstTransaction) { firstTransaction = false; selected(); await released }
      return write(tx)
    }, options))
    const lagging = reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: laggingId })
    try {
      await prepared
      if (passed) await diffFlagsAgainstParent(firstId, sourceId)
      const settled = await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: firstId })
      expect(settled).toMatchObject([{ attemptId, outcome: passed ? 'IMPROVED' : 'UNCHANGED' }])
      const receipt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
      const improvement = await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })
      const events = await prisma.improvementCycleEvent.findMany({ where: { attemptId }, orderBy: { id: 'asc' } })
      release()
      expect(await lagging).toEqual([])
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(receipt)
      expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toEqual(improvement)
      expect(await prisma.improvementCycleEvent.findMany({ where: { attemptId }, orderBy: { id: 'asc' } })).toEqual(events)
      expect(await prisma.siteLifecycleEvent.findUnique({ where: { idempotencyKey: `verify-result:${attemptId}:${laggingId}` } })).toBeNull()
    } finally { release(); await lagging; delayed.mockRestore() }
  })

  it('can still settle an inconclusive repair from later independent positive recovery', async () => {
    const incompleteId = await observed(null)
    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: incompleteId }))
      .toMatchObject([{ attemptId, outcome: 'INCONCLUSIVE' }])
    const recoveredId = await observed(true)
    await diffFlagsAgainstParent(recoveredId, sourceId)
    expect(await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: recoveredId }))
      .toMatchObject([{ attemptId, outcome: 'IMPROVED' }])
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } }))
      .toMatchObject({ outcome: 'IMPROVED', verificationAuditId: recoveredId, comparable: true })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toMatchObject({ status: 'VERIFIED' })
    expect(await prisma.improvementCycleEvent.count({ where: { attemptId, type: 'OUTCOME_ISSUED' } })).toBe(2)
  })

  it('keeps the completed repair receipt while a new monitoring failure reopens the same Improvement', async () => {
    const verifiedId = await observed(true)
    await diffFlagsAgainstParent(verifiedId, sourceId)
    await reconcileImprovementVerification({ parentAuditId: sourceId, verificationAuditId: verifiedId })
    const receipt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })
    expect(receipt).toMatchObject({ outcome: 'IMPROVED', verificationAuditId: verifiedId, comparable: true })
    const recurrenceId = await observed(false)
    await prisma.audit.update({ where: { id: recurrenceId }, data: { parentId: verifiedId } })
    const recurring = await prisma.flag.create({ data: { auditId: recurrenceId, source: 'DETERMINISTIC', checkId: 'no-https',
      rubric: 'TRUST', severity: 'IMPORTANT', pageUrl, problem: 'The recorded page used HTTP again',
      evidence: 'Controlled recurring transport observation', whyItMatters: 'Transport was insecure',
      fix: 'Restore HTTPS for the same page', confidence: 1, position: 0 } })
    await diffFlagsAgainstParent(recurrenceId, verifiedId)
    await materializeAttentionForAudit(recurrenceId)
    expect(await reconcileImprovementVerification({ parentAuditId: verifiedId, verificationAuditId: recurrenceId })).toEqual([])
    await persistFlagDiffSummary(verifiedId, recurrenceId)
    expect(await getFlagDiffSummary(verifiedId, recurrenceId)).toMatchObject({ regressed: [{ id: recurring.id }] })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: recurring.id } })).toMatchObject({ status: 'REGRESSED' })
    expect(await prisma.improvementOccurrence.findUniqueOrThrow({ where: { flagId: recurring.id } }))
      .toMatchObject({ improvementId, kind: 'REGRESSED' })
    expect(await prisma.improvement.findUniqueOrThrow({ where: { id: improvementId } })).toMatchObject({ status: 'PROPOSED' })
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attemptId } })).toEqual(receipt)
    expect(await prisma.improvement.count({ where: { projectId } })).toBe(1)
  })
})
