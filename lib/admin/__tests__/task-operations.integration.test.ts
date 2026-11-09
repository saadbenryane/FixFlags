import { randomUUID } from 'node:crypto'
import type { AuditExecutionTask, Prisma } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { loadOperations } from '../operations'
import { loadSiteOperations } from '../site-operations'
import { OPERATION_QUEUES } from '../operations'
import { LEGACY_LOCKED_PROMPT_TEXT } from '@/lib/audit/prescription-policy'
import { repairGuidanceState } from '@/lib/improvements/repair-guidance'
import { ADMIN_COPY } from '@/lib/marketing/copy/admin'

vi.mock('@/lib/queue/worker-heartbeat', () => ({ readWorkerHeartbeat: async () => null }))
const run = process.env.ACCOUNT_OPERATIONS_DB_REQUIRED === 'true' ? describe : describe.skip
run('persistent operator execution history in PostgreSQL', () => {
  const ownerId = 'task-history-' + randomUUID(), inactiveId = ownerId + '-inactive'
  const sessionId = randomUUID(), old = new Date(Date.now() - 3 * 86400_000)
  beforeAll(async () => {
    const url = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(url.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(url.pathname))
      throw new Error('Use the disposable execution verifier')
    await prisma.user.createMany({ data: [
      { id: ownerId, email: ownerId + '@example.test', role: 'admin' },
      { id: inactiveId, email: inactiveId + '@example.test', lifecycleStatus: 'SUSPENDED' },
    ] })
    await prisma.session.create({ data: { id: sessionId, userId: ownerId, token: randomUUID(), expiresAt: new Date(Date.now() + 60_000) } })
  })
  afterAll(async () => {
    await prisma.project.deleteMany({ where: { userId: { in: [ownerId, inactiveId] } } })
    await prisma.user.deleteMany({ where: { id: { in: [ownerId, inactiveId] } } })
    await prisma.$disconnect()
  })
  it('keeps old and partial failures inspectable without misclassifying inapplicability or rewriting history', async () => {
    const expected: string[] = [], snapshots: AuditExecutionTask[] = []
    const samples = [
      { name: 'old-failure', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'FAILED' as const, keep: true },
      { name: 'partial-completed', state: 'BLOCKED' as const, status: 'FAILED' as const, auditStatus: 'COMPLETED' as const, keep: true },
      { name: 'intentional-inapplicability', state: 'BLOCKED' as const, status: 'NOT_APPLICABLE' as const, auditStatus: 'COMPLETED' as const, keep: false },
      { name: 'inactive-owner', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'FAILED' as const, keep: false },
      { name: 'removed-site', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'FAILED' as const, keep: false },
      { name: 'later-success', state: 'EXHAUSTED' as const, status: 'FAILED' as const, auditStatus: 'COMPLETED' as const, keep: true },
    ]
    for (const sample of samples) {
      const project = await prisma.project.create({ data: { userId: sample.name === 'inactive-owner' ? inactiveId : ownerId,
        name: sample.name, canonicalHost: sample.name + '.test', url: 'https://' + sample.name + '.test/',
        deletedAt: sample.name === 'removed-site' ? new Date() : null, watchInterval: null } })
      const audit = await prisma.audit.create({ data: { userId: project.userId, projectId: project.id,
        url: project.url, status: sample.auditStatus, createdAt: old, completedAt: old,
        reportCompleteness: sample.auditStatus === 'COMPLETED' ? 'PARTIAL' : 'UNKNOWN' } })
      const task = await prisma.auditExecutionTask.create({ data: { auditId: audit.id, targetKey: 'task:controlled',
        source: 'DETERMINISTIC', workKind: 'http', workState: sample.state, status: sample.status,
        workErrorCode: sample.keep ? 'CONTROLLED_INCOMPLETE' : null, updatedAt: old } })
      if (sample.keep) expected.push(task.id)
      snapshots.push(task)
      if (sample.name === 'later-success') await prisma.audit.create({ data: { userId: ownerId, projectId: project.id,
        url: project.url, status: 'COMPLETED', reportCompleteness: 'FULL', completedAt: new Date() } })
    }
    const actor = { id: ownerId, sessionId, role: 'admin', email: ownerId + '@example.test', authenticatedAt: new Date() }
    const history = await loadOperations(actor, { queue: 'tasks' }), summary = await loadSiteOperations()
    expect(history.total).toBe(expected.length)
    expect(history.counts[1]).toBe(expected.length)
    expect(summary.find(item => item.label === 'Incomplete execution history')?.value).toBe(expected.length)
    expect(history.rows.map(row => row.id).sort()).toEqual(expected.sort())
    for (const row of history.rows) {
      expect(row.at).toEqual(old)
      expect(row.action).toBeNull()
      expect(row.auditId).toBe(row.targetId)
    }
    expect(await prisma.auditExecutionTask.findMany({ where: { audit: { project: { userId: { in: [ownerId, inactiveId] } } } }, orderBy: { id: 'asc' } }))
      .toEqual(snapshots.sort((a, b) => a.id.localeCompare(b.id)))
    await expect(loadOperations({ ...actor, sessionId: 'revoked' }, { queue: 'tasks' })).rejects.toThrow('Administrator access is no longer available')
  })
  it('exposes guidance gaps through the authenticated operation queue using the same eligibility as customer actions', async () => {
    const samples: Array<{ fix: string; checkId: string | null; agentPrompt?: string; cursorPrompt?: string;
      problem?: string; evidence?: string; supportingObservations?: Prisma.InputJsonValue;
      attentionPolicy?: Prisma.InputJsonValue; expectedReady?: boolean }> = [
      ...['', ' \n\t\u00a0', ...LEGACY_LOCKED_PROMPT_TEXT].map(fix => ({ fix, checkId: 'buttons-no-text' })),
      { fix: 'Replace the recorded phrase.', checkId: 'placeholder-copy-detected' },
      { fix: 'Move the recorded action.', checkId: 'cta-below-fold-mobile::page:original' },
      { fix: 'Review the recorded action.', checkId: 'cta-below-fold-mobile' },
      { fix: 'Replace the text if it is unfinished.', checkId: 'placeholder-copy-detected' },
      { fix: 'Review the recorded action. If its task requires first-screen access, adjust placement.', checkId: 'cta-below-fold-mobile' },
      { fix: '1. **Review the recorded phrase before changing educational examples.', checkId: 'placeholder-copy-detected::page:original' },
      { fix: 'Restore the failed button label.', checkId: 'buttons-no-text' },
      { fix: '', cursorPrompt: 'Restore the recorded button label.', checkId: 'buttons-no-text', expectedReady: true },
      { fix: '', agentPrompt: 'Restore the recorded button label.', checkId: null, expectedReady: true },
      { fix: 'Move the action.', cursorPrompt: 'Review the recorded action. If its task needs first-screen access, adjust placement.', checkId: 'cta-below-fold-mobile', expectedReady: true },
      { fix: '', checkId: 'noindex-meta', expectedReady: true },
      { fix: '', checkId: 'noindex-meta', attentionPolicy: { policy: 'search', version: 3, kind: 'flag', reason: 'recorded_indexing_regression' }, expectedReady: false },
      { fix: '', checkId: 'noindex-meta', attentionPolicy: { version: 99 }, expectedReady: true },
      { fix: '1.\u00a0Review the recorded phrase before changing examples.', checkId: 'placeholder-copy-detected', expectedReady: true },
      { fix: 'Reviewé the recorded phrase if it is unintended.', checkId: 'placeholder-copy-detected', expectedReady: true },
      { fix: 'checK the recorded phrase if it is unintended.', checkId: 'placeholder-copy-detected', expectedReady: false },
      { fix: '\ufeff', checkId: 'buttons-no-text', expectedReady: false },
      { fix: '', checkId: 'buttons-no-text', problem: 'Recorded unlabeled control', expectedReady: true },
      { fix: '', checkId: 'historical-unregistered', problem: 'Recorded legacy finding', expectedReady: true },
      { fix: 'Restore the recorded label.', checkId: 'buttons-no-text', evidence: '', expectedReady: false },
      { fix: 'Restore the recorded label.', checkId: 'buttons-no-text', supportingObservations: { malformed: true }, expectedReady: false },
      { fix: '', checkId: 'buttons-no-text', problem: 'Recorded but unreadable finding', supportingObservations: { malformed: true }, expectedReady: true },
      { fix: '', checkId: 'buttons-no-text', problem: '\u00a0\ufeff', expectedReady: false },
    ]
    const project = await prisma.project.create({ data: { userId: ownerId, name: 'Guidance visibility',
      canonicalHost: 'guidance.test', url: 'https://guidance.test/', watchInterval: null } })
    const audit = await prisma.audit.create({ data: { userId: ownerId, projectId: project.id,
      url: project.url, status: 'COMPLETED', completedAt: new Date(), reportCompleteness: 'PARTIAL' } })
    const expected: string[] = [], recorded = []
    for (const [position, sample] of samples.entries()) {
      const { expectedReady, ...input } = sample
      const flag = await prisma.flag.create({ data: { problem: '', evidence: 'Recorded original observation.', ...input,
        auditId: audit.id, position, source: 'DETERMINISTIC', rubric: 'EXPERIENCE',
        severity: 'IMPORTANT', confidence: 1, whyItMatters: 'Controlled schema proof.' } })
      recorded.push(flag)
      if (expectedReady !== undefined) expect(repairGuidanceState(flag) === 'ready').toBe(expectedReady)
      if (repairGuidanceState(flag) === 'unavailable') expected.push(flag.id)
    }
    const older = new Date('2026-10-01T00:00:00Z')
    const retained = Array.from({ length: 70 }, (_, index) => {
      const available = index % 5 === 0
      const id = randomUUID()
      if (!available) expected.push(id)
      return { id, auditId: audit.id, position: 100 + index, createdAt: older,
        source: 'DETERMINISTIC' as const, rubric: 'EXPERIENCE', severity: 'IMPORTANT' as const, confidence: 1,
        problem: '', evidence: 'Recorded source text.', whyItMatters: 'Controlled retained fixture.',
        fix: available ? 'Restore the recorded control.' : '' }
    })
    await prisma.flag.createMany({ data: retained })
    await prisma.flag.create({ data: { auditId: audit.id, position: 99, source: 'DETERMINISTIC', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      confidence: 1, problem: '', evidence: 'Recorded resolved fixture.', whyItMatters: 'Controlled schema proof.', fix: '', status: 'FIXED' } })
    const enriching = await prisma.audit.create({ data: { userId: ownerId, projectId: project.id, url: project.url,
      status: 'COMPLETED', completedAt: new Date(), includeAi: true, triageAt: new Date() } })
    const pending = await prisma.flag.create({ data: { auditId: enriching.id, position: 0, source: 'DETERMINISTIC', rubric: 'EXPERIENCE',
      severity: 'IMPORTANT', confidence: 1, problem: '', evidence: 'Recorded source text.', whyItMatters: 'Pending guidance.', fix: '' } })
    expect(repairGuidanceState({ ...pending, audit: enriching })).toBe('pending')
    const actor = { id: ownerId, sessionId, role: 'admin', email: ownerId + '@example.test', authenticatedAt: new Date() }
    const result = await loadOperations(actor, { queue: 'guidance' })
    const last = await loadOperations(actor, { queue: 'guidance', page: '999' })
    const rows = [...result.rows, ...last.rows]
    expect(result.total).toBe(expected.length)
    expect(result.counts[OPERATION_QUEUES.findIndex(queue => queue.id === 'guidance')]).toBe(expected.length)
    expect(result.pagination).toMatchObject({ page: 1, pages: 2 })
    expect(last.pagination).toMatchObject({ page: 2, pages: 2 })
    expect(rows.map(row => row.id).sort()).toEqual(expected.sort())
    expect(rows.every(row => row.action === null && row.auditId === audit.id && row.siteId === project.id)).toBe(true)
    expect(rows.every(row => !('evidence' in row) && !('fix' in row) && !('supportingObservations' in row))).toBe(true)
    const summary = await loadSiteOperations()
    expect(summary.find(item => item.label === ADMIN_COPY.operations.guidance)?.value).toBe(expected.length)
    for (const original of recorded) expect(await prisma.flag.findUniqueOrThrow({ where: { id: original.id } })).toEqual(original)
    await prisma.audit.update({ where: { id: enriching.id }, data: { failureCode: 'GUIDANCE_FIXTURE_EXHAUSTED' } })
    const afterEnrichment = await loadOperations(actor, { queue: 'guidance' })
    expect(afterEnrichment.total).toBe(expected.length + 1)
    expect(afterEnrichment.rows).toEqual(expect.arrayContaining([expect.objectContaining({ id: pending.id })]))
    await expect(loadOperations({ ...actor, sessionId: 'revoked' }, { queue: 'guidance' })).rejects.toThrow('Administrator access is no longer available')
    await prisma.project.update({ where: { id: project.id }, data: { deletedAt: new Date() } })
    expect((await loadOperations(actor, { queue: 'guidance' })).total).toBe(0)
  })
})
