import { randomUUID } from 'node:crypto'
import { Queue, Worker } from 'bullmq'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { createQueueRedis, createWorkerRedis } from '@/lib/queue/redis'
import { dispatchTask, loadTaskGraph, persistTaskPlan, recoverProgressiveTasks } from '../engine'
import { TASK_QUEUES, queueForTask, taskDeliveryWindow } from '../queues'
import { retireObsoleteTaskDeliveries } from '../delivery-window'
import type { TaskKind } from '../contracts'

const transport = vi.hoisted(() => ({ queues: new Map<string, Queue>() }))
vi.mock('@/lib/queue/client', () => ({ getAuditTaskQueue: (resource: string) => transport.queues.get(resource)! }))
const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('obsolete task delivery retirement with migrated PostgreSQL and Redis', () => {
  const audits: string[] = [], connections: ReturnType<typeof createQueueRedis>[] = []
  beforeAll(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    const suffix = randomUUID()
    for (const resource of Object.keys(TASK_QUEUES)) {
      const connection = createQueueRedis(); connections.push(connection)
      const queue = new Queue('delivery-retirement-' + resource + '-' + suffix, { connection })
      transport.queues.set(resource, queue); await queue.pause()
    }
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { id: { in: audits.splice(0) } } })
    for (const queue of transport.queues.values()) await queue.drain(true)
  })
  afterAll(async () => {
    for (const queue of transport.queues.values()) { await queue.obliterate({ force: true }); await queue.close() }
    connections.forEach(connection => connection.disconnect()); await prisma.$disconnect()
  })
  async function admit(kind: TaskKind = 'http') {
    const audit = await prisma.audit.create({ data: { url: 'https://example.com/', startedAt: new Date(), status: 'CAPTURING',
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://example.com/',
        environment: 'production', outcomes: [], checks: {}, verificationTarget: null } } })
    audits.push(audit.id)
    await persistTaskPlan(audit.id, [{ key: kind, kind, scope: 'page:' + audit.url, dependencies: [],
      input: { pageUrl: audit.url, position: 0, primary: true, role: 'primary' } }])
    const [task] = await loadTaskGraph(audit.id)
    expect(await dispatchTask(task.id)).toBe(true)
    return { audit, task, jobId: task.id + '-g1', queue: transport.queues.get(queueForTask(kind,
      { pageUrl: audit.url, position: 0, primary: true, role: 'primary' }))! }
  }

  it('reclaims a queued delivery after its execution fails without changing recorded history', async () => {
    const { audit, task, jobId, queue } = await admit()
    const failed = await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED', completedAt: new Date(), failureCode: 'CONTROLLED_FAILURE' } })
    const recorded = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })
    expect(await queue.getJob(jobId)).toBeDefined()
    await recoverProgressiveTasks()
    expect(await queue.getJob(jobId)).toBeUndefined()
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(failed)
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
  })

  it.each(['COMPLETED', 'BLOCKED', 'EXHAUSTED'] as const)('reclaims a delivery whose task is already %s', async workState => {
    const { audit, task, jobId, queue } = await admit()
    const recorded = await prisma.auditVerifierExecution.update({ where: { id: task.id },
      data: { workState, status: workState === 'COMPLETED' ? 'COMPLETED' : 'FAILED', workErrorCode: 'CONTROLLED_RECORDED_STATE' } })
    await retireObsoleteTaskDeliveries()
    expect(await queue.getJob(jobId)).toBeUndefined()
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toMatchObject({ status: 'CAPTURING' })
  })

  it.each(['READY', 'WAITING', 'RETRY_WAIT'] as const)('preserves an unconsumed delivery for live %s work', async workState => {
    const { task, jobId, queue } = await admit()
    const recorded = await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workState } })
    await retireObsoleteTaskDeliveries()
    expect(await queue.getJob(jobId)).toBeDefined()
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
  })

  it.each(['http', 'prescription', 'finalize'] as const)('retains completed-Audit permission for %s according to the shared completion contract', async kind => {
    const { audit, task, jobId, queue } = await admit(kind)
    const complete = await prisma.audit.update({ where: { id: audit.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
    const recorded = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })
    await retireObsoleteTaskDeliveries()
    expect(Boolean(await queue.getJob(jobId))).toBe(kind !== 'http')
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: audit.id } })).toEqual(complete)
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
  })

  it('removes a consumed generation while preserving its newly admitted retry', async () => {
    const { task, jobId, queue } = await admit()
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workGeneration: 1, workAttempts: 1,
      workDispatchState: 'PENDING', workDispatchLeaseUntil: null, workRetryAt: new Date(0) } })
    expect(await dispatchTask(task.id)).toBe(true)
    const recorded = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })
    await Promise.all([retireObsoleteTaskDeliveries(), retireObsoleteTaskDeliveries()])
    expect(await queue.getJob(jobId)).toBeUndefined()
    expect(await queue.getJob(task.id + '-g2')).toBeDefined()
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
  })

  it('reclaims an orphaned delivery after its Audit and ledger have been removed', async () => {
    const { audit, jobId, queue } = await admit()
    await prisma.audit.delete({ where: { id: audit.id } })
    await retireObsoleteTaskDeliveries()
    expect(await queue.getJob(jobId)).toBeUndefined()
  })

  it('preserves valid historical provider routing, then retires both copies after exhaustion', async () => {
    const { audit, task, jobId, queue } = await admit('pagespeed')
    const historical = transport.queues.get('provider')!
    await historical.add('historical-delivery', { auditId: audit.id, taskId: task.id, generation: 1 }, { jobId })
    await retireObsoleteTaskDeliveries()
    expect(await queue.getJob(jobId)).toBeDefined()
    expect(await historical.getJob(jobId)).toBeDefined()
    const recorded = await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workState: 'EXHAUSTED', status: 'FAILED' } })
    await retireObsoleteTaskDeliveries()
    expect(await queue.getJob(jobId)).toBeUndefined()
    expect(await historical.getJob(jobId)).toBeUndefined()
    expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
  })

  it('makes bounded progress past a full live window without a persistent sweep cursor', async () => {
    const retired = []
    for (let index = 0; index < 7; index++) {
      const record = await admit(); retired.push(record)
      await (await record.queue.getJob(record.jobId))!.changePriority({ priority: 100 })
      await prisma.audit.update({ where: { id: record.audit.id }, data: { status: 'FAILED' } })
    }
    const live = []
    for (let index = 0; index < taskDeliveryWindow('http'); index++) live.push(await admit())
    for (const remaining of [5, 3, 1, 0]) {
      await retireObsoleteTaskDeliveries(2)
      expect((await Promise.all(retired.map(record => record.queue.getJob(record.jobId)))).filter(Boolean)).toHaveLength(remaining)
      expect((await Promise.all(live.map(record => record.queue.getJob(record.jobId)))).filter(Boolean)).toHaveLength(live.length)
    }
  })

  it('continues an independent queue after one transport lookup fails, then recovers it later', async () => {
    const first = await admit(), second = await admit('pagespeed')
    await prisma.audit.updateMany({ where: { id: { in: [first.audit.id, second.audit.id] } }, data: { status: 'FAILED' } })
    vi.spyOn(first.queue, 'getJobs').mockRejectedValueOnce(new Error('Controlled queue read failure'))
    await retireObsoleteTaskDeliveries()
    expect(await first.queue.getJob(first.jobId)).toBeDefined()
    expect(await second.queue.getJob(second.jobId)).toBeUndefined()
    await retireObsoleteTaskDeliveries()
    expect(await first.queue.getJob(first.jobId)).toBeUndefined()
  })

  it('continues an independent queue after one ledger lookup fails', async () => {
    const first = await admit(), second = await admit('pagespeed')
    await prisma.audit.updateMany({ where: { id: { in: [first.audit.id, second.audit.id] } }, data: { status: 'FAILED' } })
    const read = prisma.auditVerifierExecution.findMany.bind(prisma.auditVerifierExecution)
    const interrupted = vi.spyOn(prisma.auditVerifierExecution, 'findMany').mockImplementation(args => {
      const ids = args?.where?.id
      if (ids && typeof ids === 'object' && Array.isArray(ids.in) && ids.in.includes(first.task.id))
        throw new Error('Controlled ledger read failure')
      return read(args)
    })
    try { await retireObsoleteTaskDeliveries() } finally { interrupted.mockRestore() }
    expect(await first.queue.getJob(first.jobId)).toBeDefined()
    expect(await second.queue.getJob(second.jobId)).toBeUndefined()
    await retireObsoleteTaskDeliveries()
    expect(await first.queue.getJob(first.jobId)).toBeUndefined()
  })

  it('recovers live execution while unrelated queue cleanup is still waiting', async () => {
    const { audit, task, jobId, queue } = await admit()
    await (await queue.getJob(jobId))!.remove()
    await prisma.audit.update({ where: { id: audit.id }, data: { dispatchNextAt: new Date(0) } })
    await prisma.auditVerifierExecution.update({ where: { id: task.id }, data: { workDispatchState: 'PENDING', workRetryAt: new Date(0) } })
    let release!: () => void
    const gate = new Promise<void>(resolve => { release = resolve })
    vi.spyOn(transport.queues.get('pagespeed')!, 'getJobs').mockImplementationOnce(async () => { await gate; return [] })
    const recovery = recoverProgressiveTasks()
    try {
      await vi.waitFor(async () => expect(await queue.getJob(jobId)).toBeDefined())
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } }))
        .toMatchObject({ workState: 'READY', workDispatchState: 'SENT', workAttempts: 0 })
    } finally { release(); await recovery }
  })

  it('finds a retired delivery that arrives after an earlier cleanup pass', async () => {
    const queue = transport.queues.get('http')!, add = queue.add.bind(queue)
    let release!: () => void, entered!: () => void
    const gate = new Promise<void>(resolve => { release = resolve }), sending = new Promise<void>(resolve => { entered = resolve })
    const late = vi.spyOn(queue, 'add').mockImplementation(async (...args) => { entered(); await gate; return add(...args) })
    const admission = admit()
    try {
      await sending
      const auditId = audits.at(-1)!
      await prisma.audit.update({ where: { id: auditId }, data: { status: 'FAILED' } })
      await retireObsoleteTaskDeliveries()
      release()
      const { jobId } = await admission
      expect(await queue.getJob(jobId)).toBeDefined()
      await retireObsoleteTaskDeliveries()
      expect(await queue.getJob(jobId)).toBeUndefined()
    } finally { release(); late.mockRestore(); await admission }
  })

  it('preserves an active job when stale queued-state reads race with a worker claim', async () => {
    const { audit, task, jobId, queue } = await admit()
    await prisma.audit.update({ where: { id: audit.id }, data: { status: 'FAILED' } })
    const recorded = await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })
    let release!: () => void, entered!: () => void
    const held = new Promise<void>(resolve => { release = resolve }), running = new Promise<void>(resolve => { entered = resolve })
    const connection = createWorkerRedis()
    const worker = new Worker(queue.name, async () => { entered(); await held }, { connection })
    const list = queue.getJobs.bind(queue)
    vi.spyOn(queue, 'getJobs').mockImplementationOnce(async (...args) => {
      const listed = await list(...args)
      await queue.resume(); await running
      // Model a state observation made just before the worker took its lock.
      for (const job of listed) vi.spyOn(job, 'getState').mockResolvedValueOnce('waiting')
      return listed
    })
    try {
      await worker.waitUntilReady()
      await retireObsoleteTaskDeliveries()
      expect(await (await queue.getJob(jobId))!.getState()).toBe('active')
      expect(await prisma.auditVerifierExecution.findUniqueOrThrow({ where: { id: task.id } })).toEqual(recorded)
    } finally { release(); await worker.close(); connection.disconnect(); await queue.pause() }
  })
})
