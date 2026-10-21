import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import * as scheduledRuns from '@/lib/sites/application/scheduled-runs'
import { monitoringIsOverdue } from '@/lib/sites/monitoring-freshness'
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

  it('admits a cohort beyond one batch before the unchanged lateness grace, with no duplicate Site requests', async () => {
    const dueAt = new Date()
    const ids = Array.from({ length: 61 }, () => randomUUID())
    await prisma.project.createMany({ data: ids.map((id, index) => ({ id, userId, name: 'Due fixture ' + index,
      canonicalHost: 'due-' + index + '.example.test', url: 'https://due-' + index + '.example.test/',
      watchInterval: 'WEEKLY' as const, watchNextRunAt: dueAt })) })
    // This boundary controls admission downstream of real policy and row claims.
    // It establishes scheduling throughput, not collection or worker capacity.
    const admitted = vi.spyOn(scheduledRuns, 'requestScheduledSiteRun').mockImplementation(async input => ({
      runId: 'request-' + input.projectId, auditId: 'audit-' + input.projectId, outcomeIds: [], reused: false,
    }))
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
