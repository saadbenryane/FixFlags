import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as scheduledRuns from '@/lib/sites/application/scheduled-runs'
import { calcWatchNextRun, toStoredWatchInterval } from '@/lib/audit/watch-interval'
import { monitoringIsOverdue } from '@/lib/sites/monitoring-freshness'
import { getAuditQueue } from '../client'
import { startRecoveryScheduler } from '../recovery-scheduler'

// Global maintenance windows are unavailable. Site admission has its own SQL claims.
vi.mock('@/lib/queue/lock', () => ({ tryAcquireLock: async () => false, withSchedulerLease: async () => false }))

const run = process.env.DEFAULT_MONITORING_DB_REQUIRED === 'true' ? describe : describe.skip
run('bounded monitoring admission through the installed scheduler', () => {
  let userId: string
  beforeEach(async () => {
    const target = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(target.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(target.pathname))
      throw new Error('Use the disposable execution verifier')
    userId = 'monitoring-batch-' + randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@example.test', role: 'admin' } })
  })
  afterEach(async () => {
    vi.useRealTimers(); vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it('sets up and admits independent Sites while one Site is locked, then admits the released Site', async () => {
    const now = new Date()
    // Public IP literals need no DNS lookup. The fixture queues each Audit
    // without starting a collector or sending requests to the target.
    const existing = await prisma.project.create({ data: { userId, name: 'Existing Watch',
      url: 'https://1.1.1.1/', canonicalHost: '1.1.1.1',
      watchInterval: 'WEEKLY', watchNextRunAt: now } })
    const initial = await prisma.project.create({ data: { userId, name: 'Initial Watch',
      url: 'https://8.8.8.8/', canonicalHost: '8.8.8.8', createdAt: new Date(1) } })
    const independent = await prisma.project.create({ data: { userId, name: 'Independent Watch',
      url: 'https://9.9.9.9/', canonicalHost: '9.9.9.9', createdAt: new Date(2) } })
    let release!: () => void, locked!: () => void
    const released = new Promise<void>(resolve => { release = resolve })
    const owner = new Promise<void>(resolve => { locked = resolve })
    const held = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${initial.id} FOR UPDATE`
      locked()
      await released
    }, { timeout: 15_000 })
    await Promise.race([owner, held])
    const queue = getAuditQueue()
    const requests = () => prisma.runRequest.findMany({ where: { projectId: { in: [existing.id, independent.id, initial.id] }, source: 'WATCH' },
      select: { projectId: true, auditId: true, status: true }, orderBy: { requestedAt: 'asc' } })
    vi.useFakeTimers({ now, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(4000)
      await vi.waitFor(async () => {
        expect(await prisma.project.findUniqueOrThrow({ where: { id: independent.id } })).toMatchObject({ watchNextRunAt: expect.any(Date) })
      })
      await vi.advanceTimersByTimeAsync(1000)
      await vi.waitFor(async () => {
        expect(await requests()).toEqual([existing, independent].map(site => ({ projectId: site.id, auditId: expect.any(String), status: 'QUEUED' })))
        expect(await prisma.project.count({ where: { id: { in: [existing.id, independent.id] }, watchNextRunAt: { gt: new Date() }, watchLeaseUntil: null } })).toBe(2)
      })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: initial.id } })).toMatchObject({ watchInterval: null, watchNextRunAt: null })

      release(); await held
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.waitFor(async () => {
        expect(await prisma.project.findUniqueOrThrow({ where: { id: initial.id } })).toMatchObject({ watchNextRunAt: expect.any(Date) })
      })
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.waitFor(async () => {
        expect(await requests()).toEqual([existing, independent, initial].map(site => ({ projectId: site.id, auditId: expect.any(String), status: 'QUEUED' })))
        expect(await prisma.project.count({ where: { id: initial.id, watchNextRunAt: { gt: new Date() }, watchLeaseUntil: null } })).toBe(1)
      })
      for (const request of await requests()) expect(await queue.getJob(request.auditId!)).toMatchObject({ data: { auditId: request.auditId } })
    } finally {
      release(); await held; await scheduler.stop()
      for (const request of await requests()) if (request.auditId) await queue.remove(request.auditId)
      const client = await queue.client
      await queue.close(); client.disconnect()
    }
  }, 15_000)

  it('admits a cohort beyond one batch before the unchanged lateness grace, with no duplicate Site requests', async () => {
    const dueAt = new Date()
    const ids = Array.from({ length: 61 }, () => randomUUID())
    await prisma.project.createMany({ data: ids.map((id, index) => ({ id, userId, name: 'Due fixture ' + index,
      canonicalHost: 'due-' + index + '.example.test', url: 'https://due-' + index + '.example.test/',
      watchInterval: 'WEEKLY' as const, watchNextRunAt: dueAt })) })
    // This boundary controls admission downstream of real policy and row claims.
    // It establishes scheduling throughput, not collection or worker capacity.
    const admitted = vi.spyOn(scheduledRuns, 'requestScheduledSiteRun').mockImplementation(async input => {
      const changed = await prisma.project.updateMany({ where: { id: input.projectId, userId: input.userId,
        watchInterval: toStoredWatchInterval(input.interval), watchEveryMinutes: input.everyMinutes ?? null,
        watchNextRunAt: input.scheduledAt, watchLastAttemptAt: input.claim!.attemptedAt, watchLeaseUntil: input.claim!.leaseUntil },
      data: { watchLeaseUntil: null, watchNextRunAt: calcWatchNextRun(input.interval, input.now, input.everyMinutes) } })
      expect(changed.count).toBe(1)
      return { runId: 'request-' + input.projectId, auditId: 'audit-' + input.projectId, outcomeIds: [], reused: false }
    })
    vi.useFakeTimers({ now: dueAt, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const scheduler = startRecoveryScheduler()
    try {
      for (const [advance, expected] of [[5000, 20], [25_000, 40], [30_000, 60], [30_000, 61]]) {
        await vi.advanceTimersByTimeAsync(advance)
        await vi.waitFor(async () => {
          expect(await prisma.project.count({ where: { id: { in: ids }, watchNextRunAt: { gt: dueAt }, watchLeaseUntil: null } })).toBe(expected)
        }, { timeout: 5000 })
        expect(admitted).toHaveBeenCalledTimes(expected)
      }
      expect(new Set(admitted.mock.calls.map(([input]) => input.projectId)).size).toBe(61)
      expect(monitoringIsOverdue(dueAt, new Date())).toBe(false)
      await vi.advanceTimersByTimeAsync(30_000)
      expect(admitted).toHaveBeenCalledTimes(61)
      expect(await prisma.project.count({ where: { id: { in: ids }, watchInterval: 'WEEKLY', watchConsecutiveFailures: 0 } })).toBe(61)
    } finally { await scheduler.stop() }
  })
})
