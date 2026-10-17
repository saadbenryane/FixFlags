import { TASK_QUEUES } from '../queues'
import { randomUUID } from 'node:crypto'
import type { Audit } from '@prisma/client'
import { Queue, Worker } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'
import { dispatchReadyTasks, dispatchTask, executeTask, loadTaskGraph, persistTaskPlan, reconcileTasks, recoverProgressiveTasks } from '../engine'
import { dispatchPendingAudits } from '@/lib/audit/dispatch'
import { serializeArtifact, TaskFailure, TASK_CRASH_LIMIT, MAX_TASKS_PER_AUDIT, type TaskKind, type TaskPlan } from '../contracts'
import { executionWrite, executionTransaction, withExecutionOwnership, currentExecutionOwnership, ExecutionOwnershipLost } from '@/lib/audit/execution-ownership'
import type { TaskHandler } from '../registry'
import { lifecycleHandlers } from '../lifecycle'
import * as openChecks from '@/lib/audit/open-check'
import { initialTaskPlan } from '../graph'
import { executionSpecSchema } from '@/lib/sites/domain/execution-spec'

const dispatch = vi.hoisted(() => ({ queues: new Map<string, Queue>() }))
vi.mock('@/lib/queue/client', () => ({ getAuditTaskQueue: (resource: string) => dispatch.queues.get(resource)!,
  getAuditQueue: () => dispatch.queues.get('audit')! }))
vi.mock('@/lib/audit/screenshot', () => ({ getBrowserDiagnostics: () => ({ connected: true }) }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('durable task dispatch with real PostgreSQL, Redis and workers', () => {
  const auditIds: string[] = []
  const workers: Worker[] = []
  const connections: ReturnType<typeof createQueueRedis>[] = []
  const handlers = new Map<string, TaskHandler>([['http', {
    kind: 'http', replay: 'read_only', timeoutMs: 1000,
    evaluate: async () => serializeArtifact('http', { observed: true }), validateResult: () => {},
  }]])

  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) ||
      !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Dispatch integration requires a disposable local execution database')
    const suffix = randomUUID()
    for (const resource of ['audit', ...Object.keys(TASK_QUEUES)]) {
      const connection = createQueueRedis()
      connections.push(connection)
      dispatch.queues.set(resource, new Queue('dispatch-' + resource + '-' + suffix, { connection }))
    }
    await dispatch.queues.get('browser')!.pause()
  })

  afterAll(async () => {
    await Promise.all(workers.map(worker => worker.close()))
    for (const queue of dispatch.queues.values()) {
      await queue.obliterate({ force: true })
      await queue.close()
    }
    connections.forEach(connection => connection.disconnect())
    await prisma.audit.deleteMany({ where: { id: { in: auditIds } } })
    await prisma.$disconnect()
  })

  async function admission(kinds: TaskKind[]) {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', startedAt: new Date() } })
    auditIds.push(audit.id)
    await persistTaskPlan(audit.id, kinds.map((kind, position) => ({ kind, key: 'p' + position + ':' + kind,
      scope: 'page:' + position, input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [] })))
    // Ensure graph order and due times are explicit rather than relying on CUID ordering.
    const base = Date.now() - 10_000
    for (const [index, kind] of kinds.entries()) await prisma.auditVerifierExecution.update({
      where: { auditId_targetKey_scopeKey: { auditId: audit.id, targetKey: 'task:p' + index + ':' + kind, scopeKey: 'page:' + index } },
      data: { createdAt: new Date(base + index), workRetryAt: new Date(base) },
    })
    return { audit, tasks: await loadTaskGraph(audit.id) }
  }

  async function startHttpWorker(selectedHandlers = handlers) {
    const connection = createWorkerRedis()
    connections.push(connection)
    const worker = new Worker(dispatch.queues.get('http')!.name, job => executeTask(job.data, selectedHandlers), { connection })
    workers.push(worker)
    await worker.waitUntilReady()
    return worker
  }

  async function completed(id: string) {
    await vi.waitFor(async () => {
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id } })).toMatchObject({
        workState: 'COMPLETED', workAttempts: 1, workGeneration: 1,
      })
    }, { timeout: 10_000, interval: 25 })
  }

  it('settles ready AI and HTTP work while independent PageSpeed and Google requests are still active', async () => {
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const calls: string[] = []
    const selected = new Map<string, TaskHandler>(['pagespeed', 'google', 'judge', 'http'].map(value => {
      const kind = value as TaskKind
      return [kind, { kind, replay: 'read_only', timeoutMs: 15_000, validateResult: () => {},
        async evaluate() { calls.push(kind); if (kind === 'pagespeed' || kind === 'google') await held
          return serializeArtifact(kind, { controlledExecution: true }) } }]
    }))
    const localWorkers: Worker[] = []
    try {
      const { audit, tasks } = await admission(['pagespeed', 'google', 'judge', 'http'])
      for (const resource of ['pagespeed', 'google', 'provider', 'http']) {
        const connection = createWorkerRedis(); connections.push(connection)
        const worker = new Worker(dispatch.queues.get(resource)!.name, job => executeTask(job.data, selected), { connection })
        workers.push(worker); localWorkers.push(worker); await worker.waitUntilReady()
      }
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await vi.waitFor(async () => {
        for (const kind of ['pagespeed', 'google']) expect(await prisma.auditVerifierExecution.findUniqueOrThrow({
          where: { id: tasks.find(task => task.workKind === kind)!.id } })).toMatchObject({ workState: 'RUNNING', workAttempts: 1 })
        for (const kind of ['judge', 'http']) expect(await prisma.auditVerifierExecution.findUniqueOrThrow({
          where: { id: tasks.find(task => task.workKind === kind)!.id } })).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      }, { timeout: 10_000, interval: 25 })
      expect(calls.sort()).toEqual(['google', 'http', 'judge', 'pagespeed'])
      release()
      for (const task of tasks) await completed(task.id)
    } finally { release(); await Promise.all(localWorkers.map(worker => worker.close())) }
  })

  it('executes one task generation once when historical provider and canonical PageSpeed deliveries race', async () => {
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    let evaluations = 0
    const selected = new Map<string, TaskHandler>([['pagespeed', { kind: 'pagespeed', replay: 'read_only', timeoutMs: 15_000,
      validateResult: () => {}, async evaluate() { evaluations++; await held; return serializeArtifact('pagespeed', { controlledExecution: true }) } }]])
    const localWorkers: Worker[] = []
    try {
      const { audit, tasks } = await admission(['pagespeed']), task = tasks[0]
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      const jobId = task.id + '-g1'
      const historical = await dispatch.queues.get('provider')!.add('historical-delivery', { auditId: audit.id, taskId: task.id, generation: 1 }, { jobId })
      const canonical = (await dispatch.queues.get('pagespeed')!.getJob(jobId))!
      for (const resource of ['provider', 'pagespeed']) {
        const connection = createWorkerRedis(); connections.push(connection)
        const worker = new Worker(dispatch.queues.get(resource)!.name, job => executeTask(job.data, selected), { connection })
        workers.push(worker); localWorkers.push(worker); await worker.waitUntilReady()
      }
      await vi.waitFor(async () => {
        expect(evaluations).toBe(1)
        const states = await Promise.all([historical.getState(), canonical.getState()])
        expect(states.sort()).toEqual(['active', 'completed'])
      }, { timeout: 10_000, interval: 25 })
      release(); await completed(task.id)
      await vi.waitFor(async () => expect(await Promise.all([historical.getState(), canonical.getState()])).toEqual(['completed', 'completed']))
      expect(evaluations).toBe(1)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({
        createdAt: task.createdAt, workAttempts: 1, workGeneration: 1, workState: 'COMPLETED' })
    } finally { release(); await Promise.all(localWorkers.map(worker => worker.close())) }
  })

  it('admits a maximum-sized graph in bulk and preserves completed execution on identical replay', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    auditIds.push(audit.id)
    const plans: TaskPlan[] = Array.from({ length: MAX_TASKS_PER_AUDIT }, (_, index) => ({
      kind: 'http', key: 'bounded:' + index, scope: 'page:' + index,
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies: [],
    }))
    await persistTaskPlan(audit.id, plans)
    const before = await loadTaskGraph(audit.id)
    expect(before).toHaveLength(MAX_TASKS_PER_AUDIT)
    const completed = await prisma.auditVerifierExecution.update({ where: { id: before[0].id }, data: {
      workState: 'COMPLETED', status: 'COMPLETED', workAttempts: 2, workGeneration: 3,
      workResult: serializeArtifact('http', { observed: 'original immutable evidence' }),
    } })
    await persistTaskPlan(audit.id, plans)
    const after = await loadTaskGraph(audit.id)
    expect(after.map(task => task.id).sort()).toEqual(before.map(task => task.id).sort())
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: completed.id } })).toEqual(completed)
  })

  it('retains both concurrent discoveries when a later admission carries an older summary graph', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/' } })
    auditIds.push(audit.id)
    const task = (key: string, kind: TaskKind = 'http', dependencies: string[] = []): TaskPlan => ({ key, kind,
      scope: key, input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }, dependencies })
    const graph = (key?: string): TaskPlan[] => [task('root'), ...(key ? [task(key)] : []),
      task('cross-page', 'cross-page', ['root', ...(key ? [key] : [])]),
      task('finalize', 'finalize', ['root', 'cross-page', ...(key ? [key] : [])])]
    await persistTaskPlan(audit.id, graph())
    const original = await loadTaskGraph(audit.id)
    await Promise.all([persistTaskPlan(audit.id, graph('discovered-a')), persistTaskPlan(audit.id, graph('discovered-b'))])
    await persistTaskPlan(audit.id, graph())
    const rows = await loadTaskGraph(audit.id)
    expect(rows).toHaveLength(5)
    for (const key of ['cross-page', 'finalize']) {
      const summary = rows.find(row => row.targetKey === 'task:' + key)!
      expect(summary.workDependencies).toEqual(expect.arrayContaining(['discovered-a', 'discovered-b']))
      expect(summary.id).toBe(original.find(row => row.targetKey === summary.targetKey)!.id)
    }
    const invalid = [task('root'), task('new-task'), task('cross-page', 'cross-page', ['finalize']),
      task('finalize', 'finalize', ['root'])]
    await expect(persistTaskPlan(audit.id, invalid)).rejects.toThrow('Cyclic task dependency')
    expect(await loadTaskGraph(audit.id)).toEqual(rows)
    await expect(persistTaskPlan(audit.id, [task('root', 'browser')])).rejects.toThrow('Execution task identity changed')
  })

  it('replays depth-three discovery after its expansion committed but collection was interrupted', async () => {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', reviewDepth: 3,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', reviewDepth: 3, checks: {}, outcomes: [], verificationTarget: null } } })
    auditIds.push(audit.id)
    const input = { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }
    await persistTaskPlan(audit.id, initialTaskPlan(executionSpecSchema.parse(audit.executionSpec)))
    const handler = lifecycleHandlers.find(handler => handler.kind === 'discovery')!
    const context = { audit, task: await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'discovery' } }),
      input, deadline: Date.now() + 45_000, dependencies: new Map() }
    const collect = vi.spyOn(openChecks, 'openCheckDestinations').mockRejectedValueOnce(new Error('Controlled interruption after graph admission'))
    try {
      await expect(handler.evaluate(context)).rejects.toThrow('Controlled interruption after graph admission')
      const expanded = await loadTaskGraph(audit.id)
      expect(expanded.filter(task => task.targetKey === 'task:discovery:second')).toHaveLength(1)
      const artifact = await handler.evaluate(context)
      handler.validateResult(artifact)
      expect((await loadTaskGraph(audit.id)).map(task => task.id)).toEqual(expanded.map(task => task.id))
    } finally { collect.mockRestore() }
  })

  it('retries prescription delivery from completed triage without repeating observations or losing the report', async () => {
    const { audit, tasks } = await admission(['finalize'])
    const userId = 'prescription-delivery-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test' } })
    const timestamp = new Date()
    await prisma.audit.update({ where: { id: audit.id }, data: { userId, status: 'COMPLETED', includeAi: true,
      triageAt: timestamp, completedAt: timestamp, verdict: 'Recorded triage assessment', score: 72,
      evidenceCoverage: { metadata: true, aiAssessment: true },
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: audit.url,
        environment: 'production', checks: {}, outcomes: [], verificationTarget: null } } })
    const original = await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })
    const finalizer = lifecycleHandlers.find(handler => handler.kind === 'finalize')!
    const selected = new Map<string, TaskHandler>([['finalize', finalizer]])
    const queue = dispatch.queues.get('provider')!, add = queue.add.bind(queue)
    const unavailable = vi.spyOn(queue, 'add').mockRejectedValueOnce(Object.assign(new Error('Controlled prescription queue interruption'), { code: 'ECONNRESET' }))
      .mockImplementation(add)
    try {
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
      const pending = await prisma.auditVerifierExecution.findFirstOrThrow({ where: { auditId: audit.id, workKind: 'prescription' } })
      expect(pending).toMatchObject({ workState: 'READY', workDispatchState: 'PENDING', workAttempts: 0 })
      expect(await queue.getJob(pending.id + '-g1')).toBeUndefined()
      for (let pass = 0; pass < 2; pass++) {
        await prisma.auditVerifierExecution.update({ where: { id: pending.id }, data: { workRetryAt: new Date(0) } })
        await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
        expect(await recoverProgressiveTasks()).toBeGreaterThan(0)
        const delivery = (await queue.getJob(pending.id + '-g1'))!
        expect(delivery).toMatchObject({ name: 'audit-task', data: { auditId: audit.id, taskId: pending.id, generation: 1 } })
        if (pass === 0) await delivery.remove()
      }
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED',
        completedAt: original.completedAt, triageAt: original.triageAt, verdict: original.verdict, score: original.score,
        aiReviewAt: null, evidenceCoverage: original.evidenceCoverage })
      expect(await prisma.auditVerifierExecution.count({ where: { auditId: audit.id, workKind: 'prescription' } })).toBe(1)
    } finally { unavailable.mockRestore(); await prisma.user.delete({ where: { id: userId } }) }
  })

  it('executes independent HTTP work while sixteen earlier browser deliveries remain queued', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(16).fill('browser'), 'http'])
    for (let pass = 0; pass < 3; pass++) await dispatchReadyTasks(await reconcileTasks(audit.id))
    const browser = await loadTaskGraph(audit.id)
    expect(browser.slice(0, 16).every(task => task.workState === 'READY' && task.workDispatchState === 'SENT' && task.workAttempts === 0)).toBe(true)
    const worker = await startHttpWorker()
    try { await completed(tasks[16].id) } finally { await worker.close() }
  })

  it('releases a worker after a handler exceeds its budget and preserves the incomplete task', async () => {
    const { audit, tasks } = await admission(['http', 'http'])
    let release!: () => void
    const stalled = new Promise<void>(resolve => { release = resolve })
    let started!: () => void
    const running = new Promise<void>(resolve => { started = resolve })
    const denied: unknown[] = []
    let lateFinished!: () => void
    const late = new Promise<void>(resolve => { lateFinished = resolve })
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 100,
      validateResult: () => {}, evaluate: async context => {
        if (context.task.id === tasks[0].id) {
          started()
          await stalled
          try { await executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Late write' } })) }
          catch (error) { denied.push(error) }
          try {
            await withExecutionOwnership({ ...currentExecutionOwnership()!, signal: new AbortController().signal }, () =>
              executionWrite(tx => tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Detached late write' } })))
          } catch (error) { denied.push(error) }
          lateFinished()
        }
        return serializeArtifact('http', { observed: true })
      } }]])
    await dispatchTask(tasks[0].id)
    const worker = await startHttpWorker(selected)
    try {
      await running
      await dispatchTask(tasks[1].id)
      await vi.waitFor(async () => expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[1].id } }))
        .toMatchObject({ workState: 'COMPLETED', workAttempts: 1 }), { timeout: 2000, interval: 25 })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 1, workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
    } finally { release(); await late; await worker.close() }
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workResult: null })
    expect(denied).toHaveLength(2)
    expect(denied.every(error => error instanceof ExecutionOwnershipLost)).toBe(true)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ verdict: null })
  })

  it('rolls back a commit that crosses the task deadline before releasing later work', async () => {
    const { audit, tasks } = await admission(['http'])
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 150,
      evaluate: async () => serializeArtifact('http', { observed: true }), validateResult: () => {},
      commit: async (context, _artifact, tx) => {
        await tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Uncommitted observation' } })
        await new Promise<void>(resolve => context.signal!.addEventListener('abort', () => resolve(), { once: true }))
        await tx.audit.update({ where: { id: audit.id }, data: { score: 99 } })
      },
    }]])
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ verdict: null, score: null })
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
    expect(await prisma.auditPipelineEvent.count({ where: { auditId: audit.id, event: 'task_observation_committed' } })).toBe(0)
  })

  it.each(['write', 'transaction'] as const)('rolls back an in-flight %s when its handler is cancelled', async mode => {
    const { audit, tasks } = await admission(['http'])
    const write = mode === 'write' ? executionWrite : executionTransaction
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 150,
      validateResult: () => {}, evaluate: async context => {
        await write(async tx => {
          await tx.audit.update({ where: { id: audit.id }, data: { verdict: 'Uncommitted handler write' } })
          await new Promise<void>(resolve => context.signal!.addEventListener('abort', () => resolve(), { once: true }))
          await tx.audit.update({ where: { id: audit.id }, data: { score: 99 } })
        })
        return serializeArtifact('http', { observed: true })
      },
    }]])
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ verdict: null, score: null })
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'TASK_DEADLINE_EXCEEDED', workResult: null })
  })

  it('bounds repeated task deadline failures with the existing crash limit', async () => {
    const { audit, tasks } = await admission(['http'])
    const selected = new Map<string, TaskHandler>([['http', { kind: 'http', replay: 'read_only', timeoutMs: 50,
      evaluate: async () => new Promise(() => {}), validateResult: () => {},
    }]])
    for (let generation = 1; generation <= TASK_CRASH_LIMIT; generation++) {
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation }, selected)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } })).toMatchObject({
        workAttempts: generation, workState: generation < TASK_CRASH_LIMIT ? 'RETRY_WAIT' : 'EXHAUSTED', workResult: null,
        workErrorCode: 'TASK_DEADLINE_EXCEEDED',
      })
      if (generation < TASK_CRASH_LIMIT) {
        await prisma.auditVerifierExecution.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
        expect(await reconcileTasks(audit.id)).toContain(tasks[0].id)
      }
    }
    expect(await reconcileTasks(audit.id)).toEqual([])
  })

  it.each(['refused', 'late-reconciliation'] as const)('preserves protected-effect reconciliation after timeout: %s', async phase => {
    const { audit, tasks } = await admission(['fixture-setup'])
    let effects = 0, release!: () => void, reconcile!: () => void
    const effect = new Promise<void>(resolve => { release = resolve })
    const reconciliation = new Promise<void>(resolve => { reconcile = resolve })
    const selected = new Map<string, TaskHandler>([['fixture-setup', { kind: 'fixture-setup', replay: 'protected', timeoutMs: 75,
      validateResult: () => {}, reconcile: async () => {
        if (phase === 'refused') return false
        await reconciliation
        return true
      }, evaluate: async () => { effects++; await effect; return serializeArtifact('fixture-setup', { observed: true }) },
    }]])
    try {
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
      await prisma.auditVerifierExecution.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
      await reconcileTasks(audit.id)
      await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 2 }, selected)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } })).toMatchObject({
        workState: phase === 'refused' ? 'BLOCKED' : 'RETRY_WAIT',
        workErrorCode: phase === 'refused' ? 'PROTECTED_EFFECT_UNRESOLVED' : 'TASK_DEADLINE_EXCEEDED', workResult: null,
      })
      reconcile()
      await new Promise<void>(resolve => setImmediate(resolve))
      expect(effects).toBe(1)
    } finally { release(); reconcile() }
  })

  it('defers prescription behind a live legacy writer and restores recorded completion only after its lease expires', async () => {
    const { audit, tasks } = await admission(['prescription'])
    const completedAt = new Date(), lease = new Date(Date.now() + 60_000)
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'JUDGING', progress: 70,
      completedAt, triageAt: completedAt, executionLeaseUntil: lease, executionToken: 'legacy-writer' } })
    let calls = 0
    const handler: TaskHandler = { kind: 'prescription', replay: 'idempotent', timeoutMs: 1000, validateResult: () => {},
      evaluate: async () => { calls++; return serializeArtifact('prescription', { completed: true }) } }
    const selected = new Map([['prescription', handler]])
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(calls).toBe(0)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'JUDGING', progress: 70 })
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
      .toMatchObject({ workState: 'RETRY_WAIT', workAttempts: 0, workErrorCode: 'EXECUTION_BUSY' })
    await prisma.audit.update({ where: { id: audit.id }, data: { executionLeaseUntil: new Date(0) } })
    await prisma.auditVerifierExecution.update({ where: { id: tasks[0].id }, data: { workRetryAt: new Date(0) } })
    expect(await reconcileTasks(audit.id)).toContain(tasks[0].id)
    await executeTask({ auditId: audit.id, taskId: tasks[0].id, generation: 1 }, selected)
    expect(calls).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'COMPLETED', progress: 100, completedAt })
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } })).toMatchObject({ workState: 'COMPLETED', workAttempts: 1 })
  })

  it('prioritizes unsent work and rotates due delivery checks without graph-order starvation', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(16).fill('browser'), 'http'])
    await prisma.auditVerifierExecution.updateMany({ where: { auditId: audit.id, workKind: 'browser' },
      data: { workDispatchState: 'SENT', workRetryAt: new Date(Date.now() - 1000) } })
    expect((await reconcileTasks(audit.id))[0]).toBe(tasks[16].id)
    const checked = new Set<string>()
    for (let pass = 0; pass < 3; pass++) {
      const due = await reconcileTasks(audit.id)
      due.slice(0, 8).forEach(id => checked.add(id))
      await dispatchReadyTasks(due)
    }
    expect(checked.size).toBe(17)
  })

  it('skips active dispatch leases and resumes their delivery after expiration', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(8).fill('browser'), 'http'])
    await prisma.auditVerifierExecution.updateMany({ where: { auditId: audit.id, workKind: 'browser' },
      data: { workDispatchLeaseUntil: new Date(Date.now() + 30_000) } })
    expect(await reconcileTasks(audit.id)).toEqual([tasks[8].id])
    await dispatchReadyTasks(await reconcileTasks(audit.id))
    await prisma.auditVerifierExecution.updateMany({ where: { auditId: audit.id, workKind: 'browser' },
      data: { workDispatchLeaseUntil: new Date(0) } })
    expect(await dispatchReadyTasks(await reconcileTasks(audit.id))).toBe(8)
  })

  it('reconstructs a lost Redis delivery while preserving one execution generation', async () => {
    const { audit, tasks } = await admission(['http'])
    const task = tasks[0], queue = dispatch.queues.get('http')!
    expect(await dispatchTask(task.id)).toBe(true)
    expect(await reconcileTasks(audit.id)).toEqual([])
    await (await queue.getJob(task.id + '-g1'))!.remove()
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workRetryAt: new Date(0) } })
    expect(await dispatchReadyTasks(await reconcileTasks(audit.id))).toBe(1)
    const worker = await startHttpWorker()
    try { await completed(task.id) } finally { await worker.close() }
  })

  it('claims a concurrent dispatch once, including a legacy null due time', async () => {
    const { tasks } = await admission(['http'])
    await prisma.auditVerifierExecution.update({ where: { id: tasks[0].id }, data: { workRetryAt: null } })
    expect((await Promise.all(Array.from({ length: 8 }, () => dispatchTask(tasks[0].id)))).filter(Boolean)).toHaveLength(1)
    expect(await dispatch.queues.get('http')!.getJob(tasks[0].id + '-g1')).not.toBeNull()
  })

  it('finishes independent task batches after a failed claim and retries the retained task', async () => {
    const { tasks } = await admission(Array<TaskKind>(8).fill('http'))
    const update = prisma.auditVerifierExecution.updateMany.bind(prisma.auditVerifierExecution)
    const claim = vi.spyOn(prisma.auditVerifierExecution, 'updateMany').mockImplementation(args => {
      if (args.where?.id === tasks[0].id && args.data.workDispatchLeaseUntil)
        throw new Error('Controlled task claim failure')
      return update(args)
    })
    const worker = await startHttpWorker()
    try {
      expect(await dispatchReadyTasks(tasks.map(task => task.id))).toBe(7)
      for (const task of tasks.slice(1)) await completed(task.id)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: tasks[0].id } }))
        .toMatchObject({ workState: 'READY', workAttempts: 0, workDispatchState: 'PENDING' })
      claim.mockRestore()
      expect(await dispatchTask(tasks[0].id)).toBe(true)
      await completed(tasks[0].id)
    } finally { claim.mockRestore(); await worker.close() }
  })

  it('recovers another Audit after one graph read fails without losing the failed graph', async () => {
    const broken = await admission(['http']), healthy = await admission(['http'])
    for (const audit of [broken.audit, healthy.audit]) await prisma.audit.update({ where: { id: audit.id },
      data: { executionSpec: { engine: 'progressive-v1' }, dispatchNextAt: new Date(0) } })
    const read = prisma.audit.findUnique.bind(prisma.audit)
    const failure = vi.spyOn(prisma.audit, 'findUnique').mockImplementation(args => {
      if (args.where.id === broken.audit.id) throw new Error('Controlled graph read failure')
      return read(args)
    })
    const worker = await startHttpWorker()
    try {
      expect(await recoverProgressiveTasks(2)).toBe(1)
      await completed(healthy.tasks[0].id)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: broken.tasks[0].id } }))
        .toMatchObject({ workState: 'READY', workAttempts: 0 })
      failure.mockRestore()
      await prisma.audit.update({ where: { id: broken.audit.id }, data: { dispatchNextAt: new Date(0) } })
      expect(await recoverProgressiveTasks(1)).toBe(1)
      await completed(broken.tasks[0].id)
    } finally { failure.mockRestore(); await worker.close() }
  })

  it('keeps active Audit leases out of the bounded batch and continues after a metadata read fails', async () => {
    const audits: Audit[] = []
    for (let index = 0; index < 3; index++) {
      const audit = await prisma.audit.create({ data: { url: 'https://example.com/', dispatchNextAt: new Date(index),
        ...(index === 0 ? { dispatchLeaseUntil: new Date(Date.now() + 30_000) } : {}) } })
      auditIds.push(audit.id); audits.push(audit)
    }
    const read = prisma.audit.findUniqueOrThrow.bind(prisma.audit)
    const failure = vi.spyOn(prisma.audit, 'findUniqueOrThrow').mockImplementation(args => {
      if (args.where.id === audits[1].id) throw new Error('Controlled Audit metadata read failure')
      return read(args)
    })
    try {
      expect(await dispatchPendingAudits(2)).toBe(1)
      expect(await dispatch.queues.get('audit')!.getJob(audits[0].id)).toBeUndefined()
      expect(await dispatch.queues.get('audit')!.getJob(audits[2].id)).toMatchObject({ data: { auditId: audits[2].id } })
      expect(await prisma.audit.findUnique({ where: { id: audits[1].id } })).toMatchObject({ status: 'QUEUED', dispatchState: 'PENDING', dispatchAttempts: 1 })
      failure.mockRestore()
      await prisma.audit.update({ where: { id: audits[1].id }, data: { dispatchLeaseUntil: new Date(0) } })
      expect(await dispatchPendingAudits(1)).toBe(1)
      expect(await dispatch.queues.get('audit')!.getJob(audits[1].id)).toMatchObject({ data: { auditId: audits[1].id } })
    } finally { failure.mockRestore() }
  })

  it.each(['expired', 'crashed', 'retryable-crash'] as const)('reconciles %s dependencies before releasing a dependent that precedes them in stored order', async phase => {
    const { audit, tasks } = await admission(['http', 'finalize'])
    const source = tasks.find(task => task.workKind === 'http')!, dependent = tasks.find(task => task.workKind === 'finalize')!
    await prisma.auditVerifierExecution.update({ where: { id: dependent.id }, data: {
      workState: 'WAITING', workDependencies: [source.targetKey.slice(5)], createdAt: new Date(0),
    } })
    await prisma.auditVerifierExecution.update({ where: { id: source.id }, data: phase === 'expired'
      ? { workRecoveryUntil: new Date(0) }
      : { workState: 'RUNNING', workToken: 'lost-worker', workGeneration: 1, workAttempts: phase === 'crashed' ? 3 : 1, workLeaseUntil: new Date(0) } })
    const ready = await reconcileTasks(audit.id)
    if (phase === 'retryable-crash') {
      expect(ready).not.toContain(dependent.id)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: source.id } }))
        .toMatchObject({ workState: 'RETRY_WAIT', workErrorCode: 'WORKER_INTERRUPTED' })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: dependent.id } })).toMatchObject({ workState: 'WAITING' })
    } else {
      expect(ready).toContain(dependent.id)
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: source.id } }))
        .toMatchObject({ workState: 'EXHAUSTED', workErrorCode: phase === 'expired' ? 'RECOVERY_EXHAUSTED' : 'WORKER_INTERRUPTED' })
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: dependent.id } })).toMatchObject({ workState: 'READY' })
    }
  })

  it.each(['acknowledged', 'uncertain'] as const)('preserves a fast worker retry after an %s producer response', async response => {
    const { tasks } = await admission(['http'])
    const task = tasks[0], queue = dispatch.queues.get('http')!
    const retryHandlers = new Map(handlers)
    retryHandlers.set('http', { ...handlers.get('http')!, evaluate: async () => { throw new TaskFailure('PROVIDER_QUOTA', true, 120_000) } })
    const worker = await startHttpWorker(retryHandlers)
    const add = queue.add.bind(queue)
    const delayedResponse = vi.spyOn(queue, 'add').mockImplementation(async (...args) => {
      const job = await add(...args)
      await vi.waitFor(async () => {
        expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toMatchObject({ workState: 'RETRY_WAIT' })
      }, { timeout: 10_000, interval: 25 })
      if (response === 'uncertain') throw new Error('Redis acknowledgement lost')
      return job
    })
    try {
      expect(await dispatchTask(task.id)).toBe(response === 'acknowledged')
      const saved = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })
      expect(saved).toMatchObject({ workState: 'RETRY_WAIT', workGeneration: 1, workAttempts: 1,
        workDispatchState: 'PENDING', workDispatchLeaseUntil: null, workErrorCode: 'PROVIDER_QUOTA' })
      expect(saved.workRetryAt!.getTime()).toBeGreaterThan(Date.now() + 100_000)
    } finally { delayedResponse.mockRestore(); await worker.close() }
  })
})
