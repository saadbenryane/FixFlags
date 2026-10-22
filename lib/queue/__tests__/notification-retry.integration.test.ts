import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { startRecoveryScheduler } from '../recovery-scheduler'
import { retryPendingWatchNotifications } from '@/lib/audit/project-watch'
import * as watches from '@/lib/audit/project-watch'
import * as comparison from '@/lib/audit/diff-flags'

const provider = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: provider.send } } }))
// Other distributed maintenance is unavailable. Real alert claims still own delivery.
vi.mock('@/lib/queue/lock', () => ({ tryAcquireLock: async () => false, withSchedulerLease: async () => false }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Watch retry backlog through the installed scheduler', () => {
  const users: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(async () => {
    vi.useRealTimers(); vi.restoreAllMocks()
    await prisma.audit.deleteMany({ where: { userId: { in: users } } })
    await prisma.user.deleteMany({ where: { id: { in: users } } })
    users.length = 0
  })
  afterAll(async () => { await prisma.$disconnect() })

  async function cohort(count: number) {
    const now = new Date(), userId = randomUUID()
    await prisma.user.create({ data: { id: userId, email: userId + '@notification.test', role: 'admin' } })
    users.push(userId)
    const ids = Array.from({ length: count }, () => randomUUID())
    await prisma.project.createMany({ data: ids.map(id => ({ id: 'site-' + id, userId, name: 'Notification fixture',
      canonicalHost: id + '.example.test', url: 'https://' + id + '.example.test/', watchInterval: 'WEEKLY',
      watchNextRunAt: new Date(now.getTime() + 86400_000) })) })
    await prisma.audit.createMany({ data: ids.map(id => ({ id, userId, projectId: 'site-' + id,
      url: 'https://' + id + '.example.test/', status: 'COMPLETED', recheckTrigger: 'WATCH', completedAt: now,
      improvementProjectedAt: now, reportCompleteness: 'FULL', watchRegressionCount: 1, watchRecoveryCount: 0,
      watchNotificationStatus: 'PENDING' })) })
    await prisma.flag.createMany({ data: ids.map(id => ({ auditId: id, checkId: 'security-headers-missing-csp',
      source: 'DETERMINISTIC', rubric: 'SECURITY', severity: 'IMPORTANT', confidence: 1, position: 0,
      problem: 'Content policy is missing', evidence: 'Controlled missing header', whyItMatters: 'Policy is absent', fix: 'Add the policy' })) })
    return { ids, now }
  }

  it('recovers more than one batch without consuming failed retries or duplicating accepted alerts', async () => {
    const { ids, now } = await cohort(61)
    provider.send.mockReset().mockResolvedValue({ data: { id: 'fixture-accepted' }, error: null })
    const failed = ids[0]
    provider.send.mockImplementation(async (message: { tags: Array<{ name: string; value: string }> }) =>
      message.tags.some(tag => tag.name === 'audit_id' && tag.value === failed)
        ? { data: null, error: { message: 'Controlled temporary outage' } }
        : { data: { id: 'fixture-accepted' }, error: null })
    vi.useFakeTimers({ now, toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const retries = vi.spyOn(watches, 'retryPendingWatchNotifications')
    const scheduler = startRecoveryScheduler()
    try {
      let pass = 0
      for (const [advance, settled] of [[6000, 20], [24_000, 40], [30_000, 60], [30_000, 61]]) {
        await vi.advanceTimersByTimeAsync(advance)
        expect(retries).toHaveBeenCalledTimes(++pass)
        await retries.mock.results[pass - 1].value
        expect(await prisma.audit.count({ where: {
          id: { in: ids }, watchNotificationAttempts: 1, watchNotificationStatus: { in: ['SENT', 'FAILED'] },
        } })).toBe(settled)
        expect(provider.send).toHaveBeenCalledTimes(settled)
      }
      await vi.advanceTimersByTimeAsync(30_000)
      await retries.mock.results.at(-1)!.value
      await retryPendingWatchNotifications()
      expect(provider.send).toHaveBeenCalledTimes(61)
      const receipt = await prisma.audit.findUniqueOrThrow({ where: { id: failed } })
      expect(receipt).toMatchObject({ watchNotificationStatus: 'FAILED', watchNotificationAttempts: 1,
        watchNotificationNextAttemptAt: expect.any(Date) })
      expect(receipt.watchNotificationNextAttemptAt!.getTime()).toBeGreaterThan(Date.now())
      expect(await prisma.audit.count({ where: { id: { in: ids }, watchNotificationStatus: 'SENT' } })).toBe(60)
      provider.send.mockResolvedValue({ data: { id: 'recovered-provider' }, error: null })
      vi.setSystemTime(receipt.watchNotificationNextAttemptAt!)
      await Promise.all([retryPendingWatchNotifications(), retryPendingWatchNotifications()])
      expect(provider.send).toHaveBeenCalledTimes(62)
      expect(await prisma.audit.findUniqueOrThrow({ where: { id: failed } })).toMatchObject({
        watchNotificationStatus: 'SENT', watchNotificationAttempts: 2, watchNotificationNextAttemptAt: null })
    } finally { await scheduler.stop() }
  }, 30_000)

  it.each(['PENDING', 'SENDING'] as const)('defers unreadable %s classification before the batch limit and preserves a changed retry schedule', async status => {
    const { ids, now } = await cohort(2)
    const original = comparison.getFlagDiffSummary
    const broken = ids[0], healthy = ids[1]
    await prisma.audit.update({ where: { id: broken }, data: { watchNotificationStatus: status,
      updatedAt: new Date(now.getTime() - 60_000) } })
    const classify = vi.spyOn(comparison, 'getFlagDiffSummary').mockImplementation(async (parent, child) => {
      if (child === broken) throw new Error('Controlled unreadable comparison')
      return original(parent, child)
    })
    provider.send.mockReset().mockResolvedValue({ data: { id: 'accepted' }, error: null })
    vi.useFakeTimers({ toFake: ['Date'], now })
    expect(await retryPendingWatchNotifications(1)).toBe(1)
    const deferred = await prisma.audit.findUniqueOrThrow({ where: { id: broken } })
    expect(deferred).toMatchObject({ watchNotificationAttempts: 0,
      watchNotificationNextAttemptAt: new Date(now.getTime() + 30_000) })
    expect(await retryPendingWatchNotifications(1)).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: healthy } })).toMatchObject({ watchNotificationStatus: 'SENT' })
    expect(provider.send).toHaveBeenCalledOnce()
    vi.setSystemTime(deferred.watchNotificationNextAttemptAt!)
    const later = new Date(Date.now() + 60_000)
    classify.mockImplementation(async (_parent, child) => {
      if (child !== broken) throw new Error('Unexpected retry')
      await prisma.audit.update({ where: { id: broken }, data: { watchNotificationNextAttemptAt: later } })
      throw new Error('Concurrent deferral')
    })
    expect(await retryPendingWatchNotifications(1)).toBe(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: broken } })).toMatchObject({
      watchNotificationAttempts: 0, watchNotificationNextAttemptAt: later })
    classify.mockRestore()
    vi.setSystemTime(later)
    await retryPendingWatchNotifications(1)
    expect(await prisma.audit.findUniqueOrThrow({ where: { id: broken } })).toMatchObject({
      watchNotificationStatus: 'SENT', watchNotificationAttempts: 1 })
  })
})
