import { describe, it, vi, beforeEach, afterEach, expect } from 'vitest'
import { randomUUID } from 'node:crypto'
import { Queue } from 'bullmq'
import IORedis from 'ioredis'

const auditId = `eval-audit-${randomUUID()}`

if (process.env.RECOVERY_APP_QUEUE_REQUIRED === 'true' && !process.env.REDIS_URL) {
  throw new Error('REDIS_URL is required when application audit queue recovery is a release gate')
}

const prismaMock = vi.hoisted(() => ({
  audit: { update: vi.fn(async () => ({})) },
}))

const queueRef = vi.hoisted(() => ({
  current: null as Queue | null,
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/pipeline-log', () => ({
  logPipelineEvent: vi.fn(async () => undefined),
}))
vi.mock('@/lib/queue/worker-heartbeat', () => ({
  readWorkerHeartbeat: vi.fn(async () => ({ alive: false, updatedAt: null })),
}))
vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: () => {
    if (!queueRef.current) throw new Error('test queue not initialized')
    return queueRef.current
  },
}))

import {
  WORKER_DEAD_RECOVERY_SECONDS,
  recoverAuditJobOnPoll,
} from '@/lib/audit/recover-audit-job'

const runIntegration = process.env.REDIS_URL ? describe : describe.skip

runIntegration('application audit queue recovery', () => {
  let connection: IORedis

  beforeEach(async () => {
    connection = new IORedis(process.env.REDIS_URL!, {
      family: 0,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    })
    queueRef.current = new Queue(`audit-eval-${randomUUID()}`, {
      connection: connection as never,
    })
    prismaMock.audit.update.mockClear()
  })

  afterEach(async () => {
    if (queueRef.current) {
      await queueRef.current.obliterate({ force: true }).catch(() => undefined)
      await queueRef.current.close()
      queueRef.current = null
    }
    connection.disconnect()
  })

  it('requeues a stale queued audit when the application job is missing', async () => {
    const staleUpdatedAt = new Date(Date.now() - (WORKER_DEAD_RECOVERY_SECONDS + 5) * 1000)
    const result = await recoverAuditJobOnPoll(auditId, {
      status: 'QUEUED',
      updatedAt: staleUpdatedAt,
      startedAt: null,
      createdAt: staleUpdatedAt,
    })

    expect(result).toBe('requeued')
    const job = await queueRef.current!.getJob(auditId)
    expect(job).not.toBeNull()
    expect(prismaMock.audit.update).toHaveBeenCalled()
  })

  it('requeues a stale mid-CAPTURING audit when the worker and job disappeared', async () => {
    const staleUpdatedAt = new Date(Date.now() - (WORKER_DEAD_RECOVERY_SECONDS + 5) * 1000)
    const startedAt = new Date(Date.now() - (WORKER_DEAD_RECOVERY_SECONDS + 5) * 1000)
    const result = await recoverAuditJobOnPoll(auditId, {
      status: 'CAPTURING',
      updatedAt: staleUpdatedAt,
      startedAt,
      createdAt: startedAt,
    })

    expect(result).toBe('requeued')
    expect(await queueRef.current!.getJob(auditId)).not.toBeNull()
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: auditId },
      data: { updatedAt: expect.any(Date), startedAt: null },
    })
  })
})
