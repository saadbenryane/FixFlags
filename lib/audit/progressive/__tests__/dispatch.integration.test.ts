import { randomUUID } from 'node:crypto'
import type { Audit } from '@prisma/client'
import { Queue, Worker } from 'bullmq'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'
import { dispatchReadyTasks, dispatchTask, executeTask, loadTaskGraph, persistTaskPlan, reconcileTasks, recoverProgressiveTasks } from '../engine'
import { dispatchPendingAudits } from '@/lib/audit/dispatch'
import { serializeArtifact, TaskFailure, type TaskKind } from '../contracts'
import type { TaskHandler } from '../registry'

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
    for (const resource of ['http', 'browser', 'audit'] as const) {
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

  it('executes independent HTTP work while sixteen earlier browser deliveries remain queued', async () => {
    const { audit, tasks } = await admission([...Array<TaskKind>(16).fill('browser'), 'http'])
    for (let pass = 0; pass < 3; pass++) await dispatchReadyTasks(await reconcileTasks(audit.id))
    const browser = await loadTaskGraph(audit.id)
    expect(browser.slice(0, 16).every(task => task.workState === 'READY' && task.workDispatchState === 'SENT' && task.workAttempts === 0)).toBe(true)
    const worker = await startHttpWorker()
    try { await completed(tasks[16].id) } finally { await worker.close() }
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
