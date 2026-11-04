import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/db'
import { appendImprovementCycleEvent } from './cycle-ledger'
import { recordFlagImprovementAttempt, recordOwnerFlagFeedbackDecision } from './attempts'
import { recordSiteFlagFix } from '@/lib/sites/application/flag-verification'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlags } from '@/lib/sites/flags'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('repair declaration and immutable decision custody', () => {
  let owner: string, next: string, projectId: string, auditId: string, flagId: string
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    owner = (await prisma.user.create({ data: { email: randomUUID() + '@decision-owner.test' } })).id
    next = (await prisma.user.create({ data: { email: randomUUID() + '@decision-next.test' } })).id
    projectId = (await prisma.project.create({ data: { userId: owner, name: 'Recorded decisions', url: 'https://example.com/', canonicalHost: 'example.com' } })).id
    auditId = (await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/', status: 'COMPLETED', completedAt: new Date() } })).id
    flagId = (await prisma.flag.create({ data: { auditId, source: 'DETERMINISTIC', checkId: 'buttons-no-text', rubric: 'TRUST', severity: 'IMPORTANT',
      problem: 'The search button has no accessible name', evidence: 'The recorded search control has no name',
      whyItMatters: 'Its purpose cannot be identified', fix: 'Name the original search control', confidence: 1, position: 0 } })).id
  })
  afterEach(async () => {
    await prisma.audit.deleteMany({ where: { projectId } })
    await prisma.project.deleteMany({ where: { id: projectId } })
    await prisma.user.deleteMany({ where: { id: { in: [owner, next] } } })
  })
  async function events() { return prisma.improvementCycleEvent.findMany({ where: { cycle: { projectId } }, orderBy: { id: 'asc' } }) }

  it('retains the first receipt and separately records changed semantic evidence under the same action boundary', async () => {
    await recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'copy', actor: owner, action: 'HANDOFF_COPIED' })
    const improvement = await prisma.improvement.findFirstOrThrow({ where: { projectId } })
    const input = { projectId, improvementId: improvement.id, sourceAuditId: auditId, type: 'REJECTED' as const,
      idempotencyKey: 'controlled-decision', transport: 'web', actor: owner, rejectionReason: 'LOW_IMPACT' as const,
      rejectionNote: 'Original decision', occurredAt: new Date('2026-10-01T00:00:00Z') }
    const first = await appendImprovementCycleEvent(input)
    expect(await appendImprovementCycleEvent({ ...input, occurredAt: new Date('2026-10-02T00:00:00Z') })).toEqual(first)
    const changed = { ...input, actor: next, rejectionNote: 'A later decision', occurredAt: new Date('2026-10-03T00:00:00Z') }
    const second = await appendImprovementCycleEvent(changed)
    expect(second.id).not.toBe(first.id)
    expect(await prisma.improvementCycleEvent.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first)
    expect(await appendImprovementCycleEvent(changed)).toEqual(second)
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId }, type: 'REJECTED' } })).toBe(2)
  })

  it('preserves each rejection note and the original actor instead of rewriting history', async () => {
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'incorrect', note: 'First assessment' })
    const first = (await events()).find(event => event.type === 'REJECTED')!
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'incorrect', note: 'Corrected assessment' })
    expect(await prisma.improvementCycleEvent.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first)
    expect((await events()).filter(event => event.type === 'REJECTED').map(event => event.rejectionNote).toSorted())
      .toEqual(['Corrected assessment', 'First assessment'])
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'incorrect', note: 'Corrected assessment' })
    expect((await events()).filter(event => event.type === 'REJECTED')).toHaveLength(2)
  })

  it('retains one original and one changed receipt under concurrent retries', async () => {
    await recordFlagImprovementAttempt({ flagId, userId: owner, builder: 'copy', actor: owner, action: 'HANDOFF_COPIED' })
    const improvement = await prisma.improvement.findFirstOrThrow({ where: { projectId } })
    const cold = await prisma.audit.create({ data: { projectId, userId: owner, url: 'https://example.com/', status: 'COMPLETED', completedAt: new Date() } })
    const input = { projectId, improvementId: improvement.id, sourceAuditId: cold.id, type: 'REJECTED' as const,
      idempotencyKey: 'concurrent-decision', transport: 'web', actor: owner, rejectionReason: 'LOW_IMPACT' as const,
      rejectionNote: 'Original decision' }
    const first = await Promise.all(Array.from({ length: 8 }, () => appendImprovementCycleEvent(input)))
    expect(new Set(first.map(event => event.id)).size).toBe(1)
    const changed = await Promise.all(Array.from({ length: 8 }, () => appendImprovementCycleEvent({ ...input, rejectionNote: 'Later decision' })))
    expect(new Set(changed.map(event => event.id)).size).toBe(1)
    expect(changed[0].id).not.toBe(first[0].id)
    expect(await prisma.improvementCycleEvent.findUniqueOrThrow({ where: { id: first[0].id } })).toEqual(first[0])
    expect(await prisma.improvementCycleEvent.count({ where: { cycle: { projectId }, type: 'REJECTED' } })).toBe(2)
  })

  it('creates a fresh unkeyed repair after dismissal instead of returning an older frozen attempt', async () => {
    const command = { flagId, userId: owner, builder: 'user-decision', actor: owner, action: 'READY_TO_VERIFY' as const,
      changeSummary: 'Named the original control' }
    const first = await recordFlagImprovementAttempt(command)
    await prisma.improvementAttempt.update({ where: { id: first.attemptId! }, data: { frozen: true } })
    const frozen = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: first.attemptId! } })
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Keep the exception' })
    const fresh = await recordFlagImprovementAttempt(command)
    expect(fresh.attemptId).not.toBe(first.attemptId)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: first.attemptId! } })).toEqual(frozen)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN' })
    expect(await prisma.improvement.findFirstOrThrow({ where: { projectId } })).toMatchObject({ status: 'READY_TO_VERIFY' })
  })

  it('preserves independent recovery when a previously recovered source is dismissed and redeclared', async () => {
    const url = 'https://example.com/', sourceAt = new Date('2026-10-01T00:00:00Z'), proofAt = new Date('2026-10-02T00:00:00Z')
    const spec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: url, environment: 'production',
      checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null }
    const detected = runPerformanceChecks(healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } }), null, url)[0]
    await prisma.audit.update({ where: { id: auditId }, data: { createdAt: sourceAt, completedAt: sourceAt, executionSpec: spec } })
    await prisma.flag.update({ where: { id: flagId }, data: { ...detected, whyItMatters: 'Loading delays the first useful view', createdAt: sourceAt } })
    const recovery = await prisma.audit.create({ data: { projectId, userId: owner, url, parentId: auditId, status: 'COMPLETED',
      createdAt: proofAt, completedAt: proofAt, executionSpec: spec } })
    await prisma.auditVerificationReceipt.create({ data: { auditId: recovery.id, targetKey: 'module:performance', scopeKey: 'page:' + url,
      source: 'DETERMINISTIC', status: 'COMPLETED', pageUrl: url, detail: { kind: 'site-module-check', version: 1, module: 'performance',
        pageUrl: url, applicable: true, passed: true, assertions: scopePerformanceAssertions(
          healthyDesktopPs({ lcp: 1000, diagnostics: { measurement: pageSpeedMeasurementFixture(url) } }), url,
          [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
        execution: { auditId: recovery.id, taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: proofAt.toISOString() } } } })
    await prisma.flag.update({ where: { id: flagId }, data: { status: 'FIXED', resolvedInId: recovery.id } })
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Accepted old report' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'IGNORED' })
    await recordSiteFlagFix({ siteId: projectId, flagId, userId: owner, idempotencyKey: 'retain-independent-proof' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(original)
    expect(await loadSiteFlags((await loadSiteRecord(projectId))!)).toEqual([])
  })

  it('reopens an unproven selected source while retaining the dismissal of its unselected peer', async () => {
    const original = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })
    const peer = await prisma.flag.create({ data: { auditId, source: original.source, checkId: original.checkId,
      rubric: original.rubric, severity: original.severity, problem: original.problem, evidence: original.evidence,
      whyItMatters: original.whyItMatters, fix: original.fix, confidence: original.confidence, position: 1 } })
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Selected exception' })
    await recordOwnerFlagFeedbackDecision({ flagId: peer.id, userId: owner, reason: 'intentional', note: 'Unselected exception' })
    expect(await prisma.improvement.count({ where: { projectId } })).toBe(1)
    const pointer = await prisma.audit.create({ data: { userId: owner, projectId, url: 'https://example.com/', status: 'COMPLETED', completedAt: new Date() } })
    await prisma.flag.update({ where: { id: flagId }, data: { resolvedInId: pointer.id } })
    const peerBefore = await prisma.flag.findUniqueOrThrow({ where: { id: peer.id } })
    await recordSiteFlagFix({ siteId: projectId, flagId, userId: owner, idempotencyKey: 'exact-selected-repair' })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: 'OPEN', resolvedInId: pointer.id })
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: peer.id } })).toEqual(peerBefore)
    expect((await loadSiteFlags((await loadSiteRecord(projectId))!)).map(flag => flag.sourceFlagId)).toEqual([flagId])
  })

  it('keeps clipboard custody separate after a Site transfer', async () => {
    const command = { flagId, builder: 'copy', action: 'HANDOFF_COPIED' as const }
    await recordFlagImprovementAttempt({ ...command, userId: owner, actor: owner })
    const first = (await events()).find(event => event.type === 'HANDOFF_COPIED')!
    await prisma.project.update({ where: { id: projectId }, data: { userId: next } })
    await recordFlagImprovementAttempt({ ...command, userId: next, actor: next })
    expect(await prisma.improvementCycleEvent.findUniqueOrThrow({ where: { id: first.id } })).toEqual(first)
    const after = (await events()).filter(event => event.type === 'HANDOFF_COPIED')
    expect(after.map(event => event.actor).toSorted()).toEqual([owner, next].toSorted())
    await recordFlagImprovementAttempt({ ...command, userId: next, actor: next })
    expect((await events()).filter(event => event.type === 'HANDOFF_COPIED')).toEqual(after)
    await expect(recordFlagImprovementAttempt({ ...command, userId: owner, actor: owner })).rejects.toThrow('owned Product')
  })

  it.each(['OPEN', 'REGRESSED'] as const)('reactivates a fresh %s repair but never lets its old request undo a later dismissal', async originalStatus => {
    await prisma.flag.update({ where: { id: flagId }, data: { status: originalStatus } })
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Original exception' })
    const before = await events()
    const command = { siteId: projectId, flagId, userId: owner, idempotencyKey: 'first-declared-repair', changeSummary: 'Named the search control' }
    const declared = await recordSiteFlagFix(command)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: originalStatus })
    expect((await loadSiteFlags((await loadSiteRecord(projectId))!)).map(flag => flag.sourceFlagId)).toEqual([flagId])
    expect(await prisma.improvementCycleEvent.findMany({ where: { id: { in: before.map(event => event.id) } }, orderBy: { id: 'asc' } })).toEqual(before)
    await recordOwnerFlagFeedbackDecision({ flagId, userId: owner, reason: 'intentional', note: 'Keep the later exception' })
    const dismissed = await prisma.flag.findUniqueOrThrow({ where: { id: flagId } }), history = await events()
    const attempt = await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })
    expect((await recordSiteFlagFix(command)).attemptId).toBe(declared.attemptId)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toEqual(dismissed)
    expect(await events()).toEqual(history)
    expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: declared.attemptId } })).toEqual(attempt)
    expect(await prisma.improvement.findFirstOrThrow({ where: { projectId } })).toMatchObject({ status: 'REJECTED' })
    expect((await recordSiteFlagFix({ ...command, idempotencyKey: 'a-new-declaration' })).attemptId).not.toBe(declared.attemptId)
    expect(await prisma.flag.findUniqueOrThrow({ where: { id: flagId } })).toMatchObject({ status: originalStatus })
  })
})
