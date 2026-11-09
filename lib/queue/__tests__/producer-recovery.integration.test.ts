import { randomUUID } from 'node:crypto'
import { Queue } from 'bullmq'
import { describe, expect, it, vi } from 'vitest'
import { enqueueUptimeProbe, startUptimeWorker, uptimeJobId } from '@/lib/uptime/queue'
import { getAdminOperationQueue, getAuditQueue, getAuditTaskQueue } from '../client'
import { createQueueRedis } from '../redis'

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('queue producer initialization against real Redis', () => {
  it('replaces failed initializations for shared and dedicated producers after Redis recovers', async () => {
    const database = new URL(process.env.DATABASE_URL!), broker = new URL(process.env.REDIS_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname) ||
      !['localhost', '127.0.0.1'].includes(broker.hostname)) throw new Error('Use the disposable execution verifier')
    const control = createQueueRedis()
    const observer = new Queue('uptime-probes', { connection: control })
    const observe = vi.fn(async () => {})
    const uptime = startUptimeWorker(observe)
    const warm = getAuditQueue(), shared = await warm.waitUntilReady()
    let recovered: Queue | undefined, admin: Queue | undefined
    try {
      await Promise.all([observer.waitUntilReady(), uptime.waitUntilReady()])
      const jobId = 'producer-recovery-' + randomUUID()
      const probe = { monitorId: jobId, version: 1, scheduledAt: new Date().toISOString(), attempt: 1 as const }
      const dueAt = new Date(Date.now() + 60_000)
      await control.call('CLIENT', 'PAUSE', '6500', 'ALL')
      const cold = getAuditTaskQueue('http')
      const coldAdmin = getAdminOperationQueue()
      expect(getAuditTaskQueue('http')).toBe(cold)
      await Promise.all([
        expect(cold.add('audit-task', {}, { jobId })).rejects.toThrow(/Command timed out/i),
        expect(enqueueUptimeProbe(probe, dueAt)).rejects.toThrow(/Command timed out/i),
        expect(warm.getJob(jobId)).rejects.toThrow(/Command timed out/i),
        expect(coldAdmin.getJob(jobId)).rejects.toThrow(/Command timed out/i),
      ])
      await control.call('CLIENT', 'UNPAUSE')
      await vi.waitFor(() => {
        expect(getAuditTaskQueue('http')).not.toBe(cold)
        expect(getAdminOperationQueue()).not.toBe(coldAdmin)
      })
      recovered = getAuditTaskQueue('http')
      admin = getAdminOperationQueue()
      expect(await recovered.waitUntilReady()).toBe(shared)
      expect(await admin.waitUntilReady()).toBe(shared)
      expect(getAuditQueue()).toBe(warm)
      expect(await recovered.getJob(jobId)).toBeUndefined()
      await recovered.add('audit-task', { auditId: jobId }, { jobId })
      expect(await recovered.getJob(jobId)).toMatchObject({ data: { auditId: jobId } })
      await enqueueUptimeProbe(probe, dueAt)
      const delivery = await observer.getJob(uptimeJobId(probe))
      expect(delivery).toMatchObject({ data: probe })
      await delivery!.promote()
      await vi.waitFor(() => expect(observe).toHaveBeenCalledExactlyOnceWith(probe))
      expect(await warm.getJob(jobId)).toBeUndefined()
    } finally {
      try { await control.call('CLIENT', 'UNPAUSE') }
      finally {
        try { await Promise.all([uptime.close(), observer.close(), warm.close(), recovered?.close(), admin?.close()]) }
        finally { shared.disconnect(); control.disconnect() }
      }
    }
  }, 20_000)
})
