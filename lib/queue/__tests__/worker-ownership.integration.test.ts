import { afterAll, describe, expect, it, vi } from 'vitest'
import { startProgressiveWorkers } from '@/lib/audit/progressive/runtime'
import * as redisClients from '../redis'
import { prisma } from '@/lib/db'
import { TASK_QUEUES } from '@/lib/audit/progressive/queues'
import { createOwnedQueue, createOwnedWorker } from '../bullmq-ownership'
import { randomUUID } from 'node:crypto'
import { persistTaskPlan, reconcileTasks, dispatchReadyTasks, loadTasks } from '@/lib/audit/progressive/engine'
import { serializeArtifact } from '@/lib/audit/progressive/contracts'
import { getAuditTaskQueue } from '../client'
import { CHECK_REGISTRY } from '@/lib/audit/check-registry'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' && process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' ? describe : describe.skip
run('native BullMQ connection ownership', () => {
  afterAll(() => prisma.$disconnect())
  it('releases every supplied progressive worker connection after repeated drain and restart', async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    const observer = redisClients.createQueueRedis()
    await observer.ping()
    const created: ReturnType<typeof redisClients.createWorkerRedis>[] = []
    const original = redisClients.createWorkerRedis
    const factory = vi.spyOn(redisClients, 'createWorkerRedis').mockImplementation(() => {
      const client = original(); created.push(client); return client
    })
    let workers: ReturnType<typeof startProgressiveWorkers> | undefined
    try {
      for (let cycle = 0; cycle < 2; cycle++) {
        const start = created.length
        workers = startProgressiveWorkers(); await workers.waitUntilReady()
        const owned = created.slice(start)
        expect(owned).toHaveLength(Object.keys(TASK_QUEUES).length)
        const ids = new Set(await Promise.all(owned.map(async client => String(await client.client('ID')))))
        const closing = workers.close()
        expect(workers.close()).toBe(closing)
        await closing; workers = undefined
        const live = String(await observer.client('LIST')).split('\n').flatMap(line => line.match(/^id=(\d+)/)?.[1] ?? [])
        expect(live.filter(id => ids.has(id))).toEqual([])
        expect(owned.map(client => client.status)).toEqual(owned.map(() => 'end'))
        expect(await observer.ping()).toBe('PONG')
      }
    } finally {
      await workers?.close()
      factory.mockRestore(); created.forEach(client => client.disconnect()); observer.disconnect()
    }
  })
  it('drains graph publication after physical workers close while retaining the producer', async () => {
    const observer = redisClients.createQueueRedis(), created: ReturnType<typeof redisClients.createWorkerRedis>[] = []
    const original = redisClients.createWorkerRedis
    const factory = vi.spyOn(redisClients, 'createWorkerRedis').mockImplementation(() => {
      const client = original(); created.push(client); return client
    })
    const pageUrl = 'https://example.com/', input = { pageUrl, position: 0, primary: true, role: 'primary' }
    const audit = await prisma.audit.create({ data: { url: pageUrl, startedAt: new Date(), executionSpec: {
      version: 1, engine: 'progressive-v1', targetUrl: pageUrl, scope: 'SITE', environment: 'production',
      checks: { 'page-http-error': CHECK_REGISTRY['page-http-error'].version }, outcomes: [], verificationTarget: null,
    } } })
    await persistTaskPlan(audit.id, [
      { key: 'collected', kind: 'http', scope: pageUrl, input, dependencies: [] },
      { key: 'source', kind: 'check', scope: pageUrl, input: { ...input, module: 'page-response' }, dependencies: ['collected'] },
      { key: 'follow-up', kind: 'http', scope: pageUrl, input, dependencies: ['source'] },
    ])
    await prisma.auditExecutionTask.updateMany({ where: { auditId: audit.id, targetKey: 'task:collected' }, data: {
      workState: 'COMPLETED', status: 'COMPLETED', workResult: serializeArtifact('http', { metadata: null, document: {
        url: pageUrl, finalUrl: pageUrl, status: 200, headers: { 'content-type': 'text/html' }, body: '<title>Useful service</title><h1>Service</h1>',
        complete: true, reason: null, redirects: [], collectedAt: new Date().toISOString(),
      } }),
    } })
    const tasks = await loadTasks(audit.id), source = tasks.find(task => task.targetKey === 'task:source')!
    const dependent = tasks.find(task => task.targetKey === 'task:follow-up')!
    const producer = getAuditTaskQueue('http'), evaluation = getAuditTaskQueue('evaluate'), add = producer.add.bind(producer)
    const held = Promise.withResolvers<void>(), entered = Promise.withResolvers<void>()
    const publication = vi.spyOn(producer, 'add').mockImplementation(async (...args) => {
      if (args[1].taskId === dependent.id) { entered.resolve(); await held.promise }
      return add(...args)
    })
    const workers = startProgressiveWorkers()
    let closed = false
    try {
      await workers.waitUntilReady()
      const ids = new Set(await Promise.all(created.map(async client => String(await client.client('ID')))))
      await dispatchReadyTasks(await reconcileTasks(audit.id))
      await entered.promise
      await vi.waitFor(async () => expect(await (await evaluation.getJob(source.id + '-g1'))?.getState()).toBe('completed'),
        { timeout: 3000, interval: 20 })
      const closing = workers.close()
      void closing.then(() => { closed = true })
      await vi.waitFor(async () => {
        const live = String(await observer.client('LIST')).split('\n').flatMap(line => line.match(/^id=(\d+)/)?.[1] ?? [])
        expect(live.filter(id => ids.has(id))).toEqual([])
      }, { timeout: 3000, interval: 20 })
      expect(closed).toBe(false)
      expect(await (await producer.client).ping()).toBe('PONG')
      held.resolve(); await closing
      expect(closed).toBe(true)
      expect(await producer.getJob(dependent.id + '-g1')).toMatchObject({ data: { taskId: dependent.id, generation: 1 } })
      expect(await prisma.auditExecutionTask.findUniqueOrThrow({ where: { id: dependent.id } }))
        .toMatchObject({ workState: 'READY', workAttempts: 0 })
    } finally {
      held.resolve(); await workers.close(); publication.mockRestore(); factory.mockRestore()
      await (await producer.getJob(dependent.id + '-g1'))?.remove()
      await prisma.audit.delete({ where: { id: audit.id } })
      const clients = await Promise.all([producer.client, evaluation.client])
      await Promise.all([producer.close(), evaluation.close()])
      new Set(clients).forEach(client => client.disconnect())
      created.forEach(client => client.disconnect()); observer.disconnect()
    }
  }, 15_000)

  it('retains a live worker connection through its job acknowledgement and closes only its own clients', async () => {
    const name = 'owned-' + randomUUID(), observer = redisClients.createQueueRedis()
    const producer = createOwnedQueue(name)
    let started = false, finish!: () => void
    const held = new Promise<void>(resolve => { finish = resolve })
    const worker = createOwnedWorker(name, async () => { started = true; await held; return 'recorded' }, { concurrency: 1 })
    worker.on('error', () => {})
    try {
      await worker.waitUntilReady()
      const connection = await worker.client
      const workerId = String(await connection.client('ID'))
      const job = await producer.add('observation', {})
      await vi.waitFor(() => expect(started).toBe(true), { timeout: 2000, interval: 10 })
      const closing = worker.close()
      expect(worker.close()).toBe(closing)
      expect(await connection.ping()).toBe('PONG')
      finish(); await closing
      expect(await job.getState()).toBe('completed')
      expect((await producer.getJob(job.id!))?.returnvalue).toBe('recorded')
      expect(String(await observer.client('LIST'))).not.toMatch(new RegExp('^id=' + workerId + ' ', 'm'))
      const producerConnection = await producer.client
      const producerId = String(await producerConnection.client('ID'))
      await producer.close()
      expect(String(await observer.client('LIST'))).not.toMatch(new RegExp('^id=' + producerId + ' ', 'm'))
      expect(await observer.ping()).toBe('PONG')
    } finally { finish(); await worker.close(); await producer.close(); observer.disconnect() }
  })
  it('closes a disconnected producer during its reconnect delay without another connection attempt', async () => {
    const observer = redisClients.createQueueRedis(), producer = createOwnedQueue('disconnected-' + randomUUID())
    const connection = await producer.client
    try {
      const id = String(await connection.client('ID'))
      const retrying = new Promise<void>(resolve => { connection.once('reconnecting', () => resolve()) })
      await observer.client('KILL', 'ID', id)
      await retrying
      expect(connection.status).toBe('reconnecting')
      await producer.close()
      const reconnected = vi.fn()
      connection.on('connect', reconnected)
      await new Promise(resolve => setTimeout(resolve, 120))
      expect(reconnected).not.toHaveBeenCalled()
      expect(await observer.ping()).toBe('PONG')
    } finally { connection.disconnect(); await producer.close(); observer.disconnect() }
  })
})
