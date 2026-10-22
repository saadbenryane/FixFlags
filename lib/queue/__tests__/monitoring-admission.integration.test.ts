import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as scheduledRuns from '@/lib/sites/application/scheduled-runs'
import { monitoringIsOverdue } from '@/lib/sites/monitoring-freshness'
import { startRecoveryScheduler } from '../recovery-scheduler'
import { calcWatchNextRun, toStoredWatchInterval } from '@/lib/audit/watch-interval'

// Global maintenance windows are unavailable. Site admission has its own SQL claims.
vi.mock('@/lib/queue/lock', () => ({ tryAcquireLock: async () => false, withSchedulerLease: async () => false }))
// Admission validates DNS but never executes these controlled public targets.
vi.mock('node:dns/promises', () => ({ resolve4: async () => ['93.184.216.34'], resolve6: async () => [] }))

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
    await prisma.audit.deleteMany({ where: { userId } })
    await prisma.user.deleteMany({ where: { id: userId } })
  })

  it('admits existing care while initial setup waits on another Site and resumes that setup after release', async () => {
    const dueAt = new Date()
    const existing = await prisma.project.create({ data: { userId, name: 'Existing care',
      canonicalHost: 'existing-care.example.test', url: 'https://existing-care.example.test/',
      watchInterval: 'WEEKLY', watchNextRunAt: dueAt } })
    const initial = await prisma.project.create({ data: { userId, name: 'Initial care',
      canonicalHost: 'initial-care.example.test', url: 'https://initial-care.example.test/' } })
    const paused = await prisma.project.create({ data: { userId, name: 'Paused care',
      canonicalHost: 'paused-care.example.test', url: 'https://paused-care.example.test/', watchLastError: 'Paused.' } })
    let release!: () => void, locked!: (pid: number) => void
    const released = new Promise<void>(resolve => { release = resolve })
    const owner = new Promise<number>(resolve => { locked = resolve })
    const held = prisma.$transaction(async tx => {
      const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${initial.id} FOR UPDATE`
      locked(pid)
      await released
    }, { timeout: 15_000 })
    const pid = await owner
    vi.useFakeTimers({ now: dueAt, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const scheduler = startRecoveryScheduler()
    try {
      await vi.advanceTimersByTimeAsync(5000)
      await vi.waitFor(async () => {
        const [{ count }] = await prisma.$queryRaw<Array<{ count: number }>>`
          SELECT COUNT(*)::int AS count FROM pg_stat_activity WHERE ${pid} = ANY(pg_blocking_pids(pid))`
        expect(count).toBeGreaterThan(0)
      }, { timeout: 2000, interval: 20 })
      // Actual transactional admission advances this Site while the independent
      // setup transaction is still physically blocked in PostgreSQL. No worker
      // executes these URLs, so admission is not website-observation proof.
      await vi.waitFor(async () => {
        expect(await prisma.runRequest.count({ where: { projectId: existing.id, source: 'WATCH' } })).toBe(1)
        const saved = await prisma.project.findUniqueOrThrow({ where: { id: existing.id } })
        expect(saved.watchLeaseUntil).toBeNull()
        expect(saved.watchNextRunAt!.getTime()).toBeGreaterThan(dueAt.getTime())
      }, { timeout: 2000, interval: 20 })
      expect(await prisma.project.findUniqueOrThrow({ where: { id: initial.id } })).toMatchObject({ watchInterval: null, watchNextRunAt: null })
      expect(await prisma.runRequest.count({ where: { projectId: initial.id } })).toBe(0)
      release(); await held
      await vi.waitFor(async () => {
        expect(await prisma.project.findUniqueOrThrow({ where: { id: initial.id } })).toMatchObject({ watchInterval: 'DAILY' })
      }, { timeout: 2000, interval: 20 })
      await vi.advanceTimersByTimeAsync(30_000)
      await vi.waitFor(async () => {
        expect(await prisma.runRequest.count({ where: { projectId: initial.id, source: 'WATCH' } })).toBe(1)
      }, { timeout: 2000, interval: 20 })
      expect(await prisma.runRequest.count({ where: { projectId: existing.id, source: 'WATCH' } })).toBe(1)
      expect(await prisma.siteOutcome.count({ where: { projectId: initial.id, slug: 'page-loads' } })).toBe(1)
      expect(await prisma.project.findUniqueOrThrow({ where: { id: paused.id } })).toMatchObject({
        watchInterval: null, watchNextRunAt: null, watchLastError: 'Paused.' })
      expect(await prisma.siteOutcome.count({ where: { projectId: paused.id } })).toBe(0)
    } finally { release(); await held; await scheduler.stop() }
  })

  it('admits a cohort beyond one batch before the unchanged lateness grace, with no duplicate Site requests', async () => {
    const dueAt = new Date()
    const ids = Array.from({ length: 61 }, () => randomUUID())
    await prisma.project.createMany({ data: ids.map((id, index) => ({ id, userId, name: 'Due fixture ' + index,
      canonicalHost: 'due-' + index + '.example.test', url: 'https://due-' + index + '.example.test/',
      watchInterval: 'WEEKLY' as const, watchNextRunAt: dueAt })) })
    // This boundary controls admission downstream of real policy and row claims.
    // It establishes scheduling throughput, not collection or worker capacity.
    const admitted = vi.spyOn(scheduledRuns, 'requestScheduledSiteRun').mockImplementation(async input => {
      const claim = input.claim!
      // This controlled admission owns advancement, as the actual command does.
      // The outer sweep must not independently advance a returned receipt.
      const changed = await prisma.project.updateMany({ where: { id: input.projectId, userId: input.userId,
        watchInterval: toStoredWatchInterval(input.interval), watchEveryMinutes: input.everyMinutes ?? null,
        watchNextRunAt: input.scheduledAt, watchLastAttemptAt: claim.attemptedAt, watchLeaseUntil: claim.leaseUntil },
        data: { watchLeaseUntil: null, watchNextRunAt: calcWatchNextRun(input.interval, input.now, input.everyMinutes) } })
      if (changed.count !== 1) throw new Error('Controlled admission lost its Site claim')
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
