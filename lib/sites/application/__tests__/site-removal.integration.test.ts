import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { executionWrite, ExecutionOwnershipLost, withExecutionOwnership } from '@/lib/audit/execution-ownership'
import { executeTask, loadTaskGraph, persistTaskPlan } from '@/lib/audit/progressive/engine'
import { serializeArtifact } from '@/lib/audit/progressive/contracts'
import type { TaskHandler } from '@/lib/audit/progressive/registry'
import { removeSite } from '../settings-commands'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site removal with real execution and persistence', () => {
  const userId = 'removal-' + randomUUID()
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) ||
      !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Site removal proof requires a disposable local execution database')
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', name: 'Removal proof' } })
  })
  afterAll(async () => { await prisma.user.delete({ where: { id: userId } }); await prisma.$disconnect() })

  it('fences an in-flight writer and duplicate deliveries while preserving completed history', async () => {
    const project = await prisma.project.create({ data: { userId, name: 'Controlled removal', url: 'https://example.com/', canonicalHost: 'example.com' } })
    const owner = { projectId: project.id, userId }
    const historical = await prisma.audit.create({ data: { userId, projectId: project.id, url: project.url, status: 'COMPLETED', completedAt: new Date() } })
    const audit = await prisma.audit.create({ data: { userId, projectId: project.id, url: project.url, status: 'CHECKING', startedAt: new Date() } })
    const outcomes = await Promise.all(['completed', 'pending'].map(slug => prisma.siteOutcome.create({
      data: { projectId: project.id, slug, name: slug },
    })))
    const request = await prisma.runRequest.create({ data: { projectId: project.id, source: 'WEB', idempotencyKey: 'removal',
      auditId: audit.id, status: 'RUNNING', selections: { create: outcomes.map(outcome => ({ outcomeId: outcome.id })) } } })
    const preserved = await prisma.outcomeAssessment.create({ data: { outcomeId: outcomes[0].id, runRequestId: request.id,
      auditId: audit.id, state: 'CLEAR', summary: 'Recorded observation', validUntil: new Date(Date.now() + 60_000), evidence: { receipt: 'original' } } })
    const improvement = await prisma.improvement.create({ data: { projectId: project.id, fingerprint: 'removal', title: 'Original failure',
      judgment: 'Observed failure', expectedBenefit: 'Recovery', recommendedChange: 'Repair', successCondition: 'Fresh comparable observation' } })
    const attempt = await prisma.improvementAttempt.create({ data: { improvementId: improvement.id, sourceAuditId: historical.id,
      verificationAuditId: audit.id, builder: 'manual' } })
    await persistTaskPlan(audit.id, [0, 1].map(position => ({ kind: 'http' as const, key: 'p' + position + ':http', scope: 'page:' + position,
      input: { pageUrl: project.url, position, primary: position === 0, role: 'primary' }, dependencies: [] })))
    const tasks = await loadTaskGraph(audit.id)
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    const evaluate = vi.fn(async () => { await gate; return serializeArtifact('http', { observed: true }) })
    const commit = vi.fn<NonNullable<TaskHandler['commit']>>(async (_context, _result, tx) => {
      await tx.audit.update({ where: { id: audit.id }, data: { errorMsg: 'Stale write' } })
    })
    const handlers = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 5000,
      evaluate, validateResult: () => {}, commit }]])
    const job = { auditId: audit.id, taskId: tasks[0].id, generation: 1 }
    const execution = executeTask(job, handlers)
    try {
      await vi.waitFor(() => expect(evaluate).toHaveBeenCalledOnce())
      const executing = await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: tasks[0].id } })
      await removeSite(owner)
      await expect(withExecutionOwnership({ auditId: audit.id, taskId: executing.id, token: executing.workToken!, generation: 1 },
        () => executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { errorMsg: 'Stale write' } }))))
        .rejects.toBeInstanceOf(ExecutionOwnershipLost)
      release()
      await execution
      await Promise.all([executeTask(job, handlers), executeTask({ ...job, taskId: tasks[1].id }, handlers)])
      expect(evaluate).toHaveBeenCalledOnce()
      expect(commit).not.toHaveBeenCalled()
      expect(await prisma.runRequest.findUniqueOrThrow({ where: { id: request.id } })).toMatchObject({ status: 'FAILED', errorCode: 'SITE_REMOVED', leaseUntil: null })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'FAILED', failureCode: 'SITE_REMOVED', executionToken: null })
      expect((await loadTaskGraph(audit.id)).every(task => task.workState === 'BLOCKED' && task.workToken === null && task.workLeaseUntil === null)).toBe(true)
      expect(await prisma.improvementAttempt.findUniqueOrThrow({ where: { id: attempt.id } })).toMatchObject({ outcome: 'INCONCLUSIVE', comparable: false })
      expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { id: preserved.id } })).toEqual(preserved)
      expect(await prisma.outcomeAssessment.findUniqueOrThrow({ where: { runRequestId_outcomeId: { runRequestId: request.id, outcomeId: outcomes[1].id } } }))
        .toMatchObject({ state: 'COULD_NOT_VERIFY', coverage: { observedBindings: [] } })
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: historical.id } })).toEqual(historical)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: project.id } })).toMatchObject({ deletedAt: expect.any(Date), accountChecksEnabled: false })
    } finally { release(); await execution }
  })
})
