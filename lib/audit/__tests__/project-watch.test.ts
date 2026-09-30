import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Resend } from 'resend'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectUpdate: vi.fn(),
  projectUpdateMany: vi.fn(),
  projectFindFirst: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  auditFindMany: vi.fn(),
  auditUpdateMany: vi.fn(),
  auditUpdate: vi.fn(),
  requestSiteRun: vi.fn(),
  siteOutcomeFindMany: vi.fn(),
  getFlagDiffSummary: vi.fn(),
  sendEmail: vi.fn(),
  recordSiteLifecycleEvent: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: mocks.projectFindMany,
      findFirst: mocks.projectFindFirst,
      update: mocks.projectUpdate,
      updateMany: mocks.projectUpdateMany,
    },
    audit: {
      findFirst: mocks.auditFindFirst,
      findUnique: mocks.auditFindUnique,
      findMany: mocks.auditFindMany,
      updateMany: mocks.auditUpdateMany,
      update: mocks.auditUpdate,
    },
    siteOutcome: { findMany: mocks.siteOutcomeFindMany },
  },
}))
vi.mock('@/lib/sites/application/run-requests', () => ({
  requestSiteRun: mocks.requestSiteRun,
}))
vi.mock('@/lib/audit/diff-flags', () => ({ getFlagDiffSummary: mocks.getFlagDiffSummary }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: mocks.sendEmail } } }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: mocks.recordSiteLifecycleEvent }))

import {
  notifyWatchRegression,
  processDueProjectWatches,
  retryPendingWatchNotifications,
  setProjectWatch,
} from '@/lib/audit/project-watch'
import { fixedClock } from '@/lib/time/clock'

const project = {
  id: 'project-1',
  userId: 'user-1',
  watchInterval: 'WEEKLY',
  watchNextRunAt: new Date('2026-07-22T10:00:00.000Z'),
  watchConsecutiveFailures: 0,
  user: { id: 'user-1', plan: 'TEAM', role: 'user', subscriptionStatus: 'ACTIVE' },
}

describe('Product Watch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('REDIS_URL', 'redis://watch.test')
    vi.stubEnv('RESEND_API_KEY', 're_watch_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'watch@example.test')
    mocks.projectFindMany.mockResolvedValue([project])
    mocks.projectUpdate.mockResolvedValue(project)
    mocks.projectUpdateMany.mockResolvedValue({ count: 1 })
    mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
    mocks.sendEmail.mockResolvedValue({ data: { id: 'email-1' }, error: null })
    mocks.projectFindFirst.mockResolvedValue({ id: 'project-1', user: project.user })
    mocks.siteOutcomeFindMany.mockResolvedValue([])
    mocks.requestSiteRun.mockResolvedValue({ runId: 'run-1', auditId: 'child-1', reused: false })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('enables weekly scheduled reviews for a Studio Product', async () => {
    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'weekly',
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({ watchInterval: 'WEEKLY' }),
    }))
  })

  it('limits Free Sites to weekly watching', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      id: 'project-1',
      user: { ...project.user, plan: 'FREE' },
    })

    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'daily',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Daily watching is available on Pro and Studio. Free Sites watch weekly.',
      code: 'INTERVAL_NOT_ALLOWED',
    })
    expect(mocks.projectUpdate).not.toHaveBeenCalled()
  })

  it('pauses without wiping the interval', async () => {
    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: null,
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({
        watchNextRunAt: null,
        watchLastError: 'Paused. This Site is not on a check schedule.',
      }),
    }))
    expect(mocks.projectUpdate.mock.calls[0][0].data.watchInterval).toBeUndefined()
  })

  it('enables weekly watching on Free', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      id: 'project-1',
      user: { ...project.user, plan: 'FREE' },
    })

    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'weekly',
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdate).toHaveBeenCalled()
  })

  it('enables daily Watch on the same terms as weekly Watch', async () => {
    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'daily',
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ watchInterval: 'DAILY' }),
    }))
  })

  it('queries all due entitled Products, including unmanaged claimed Products', async () => {
    mocks.auditFindFirst.mockResolvedValueOnce(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'outcome-1' }])

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(mocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ isManaged: expect.anything() }),
    }))
    expect(mocks.requestSiteRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      source: 'WATCH',
    }))
  })

  it('does not enqueue an overlapping scheduled re-check', async () => {
    mocks.auditFindFirst.mockResolvedValueOnce({ id: 'active-child' })

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(mocks.requestSiteRun).not.toHaveBeenCalled()
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({ watchNextRunAt: expect.any(Date) }),
    }))
  })

  it('runs every bound Outcome through one Watch request', async () => {
    mocks.auditFindFirst.mockResolvedValueOnce(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'signup-1' }, { id: 'checkout-1' }])

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(mocks.requestSiteRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      outcomeIds: ['signup-1', 'checkout-1'],
      userId: 'user-1',
      source: 'WATCH',
    }))
  })

  it('pauses at the renewal boundary when monthly Review capacity is exhausted', async () => {
    const renewalAt = new Date('2026-09-01T00:00:00.000Z')
    mocks.auditFindFirst.mockResolvedValueOnce(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'outcome-1' }])
    mocks.requestSiteRun.mockRejectedValue(
      Object.assign(new Error('Monthly Review allowance used'), {
        code: 'UPGRADE_REQUIRED',
        renewalAt,
      })
    )

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        watchLeaseUntil: null,
        watchNextRunAt: renewalAt,
        watchLastError:
          'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
      },
    })
  })

  it('sends at most one regression notification per child report', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: 1,
      watchNotificationStatus: 'SENT',
      watchNotificationAttempts: 1,
      user: { email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' },
    })
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
    })
    mocks.auditUpdateMany.mockResolvedValue({ count: 0 })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('sends only for a measured regression with a stable idempotency key', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: null,
      watchNotificationStatus: null,
      watchNotificationAttempts: 0,
      user: { email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' },
    })
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
    })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com' }),
      { idempotencyKey: 'fixflags-watch-child-1-v1' }
    )
    expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'child-1' },
      data: expect.objectContaining({ watchNotificationStatus: 'SENT' }),
    }))
  })

  it('records a clean watch result without sending email', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: null,
      watchNotificationStatus: null,
      watchNotificationAttempts: 0,
      user: { email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' },
    })
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [{ id: 'fixed' }], inconclusive: [], unchanged: [], newIssues: [], regressed: [],
    })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: 'child-1' },
      data: { watchRegressionCount: 0, watchNotificationStatus: 'NOT_APPLICABLE' },
    })
  })

  it('links a recovery notification to the parent Flag that holds its proof', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: null,
      watchNotificationStatus: null,
      watchNotificationAttempts: 0,
      user: { email: 'owner@example.com', name: 'Owner' },
      project: {
        watchInterval: 'WEEKLY',
        notificationLevel: 'ALL',
        notifyOnRecovery: true,
      },
    })
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [{
        id: 'parent-fixed-flag',
        checkId: 'cta-dead-link',
        problem: 'Primary action was broken',
        rubric: 'EXPERIENCE',
        severity: 'IMPORTANT',
        status: 'OPEN',
      }],
      inconclusive: [],
      unchanged: [],
      newIssues: [],
      regressed: [],
    })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: expect.stringContaining(
          '/sites/project-1/flags/parent-fixed-flag?source=watch-email'
        ),
      }),
      { idempotencyKey: 'fixflags-watch-child-1-v1' }
    )
  })

  describe('notification delivery truth', () => {
    beforeEach(() => {
      mocks.auditFindUnique.mockResolvedValue({
        id: 'child-1',
        url: 'https://example.com/',
        projectId: 'project-1',
        recheckTrigger: 'WATCH',
        completedAt: new Date('2026-07-22T12:00:00.000Z'),
        watchRegressionCount: 1,
        watchNotificationStatus: 'PENDING',
        watchNotificationAttempts: 0,
        user: { email: 'owner@example.test', name: 'Owner' },
        project: { watchInterval: 'WEEKLY' },
      })
      mocks.getFlagDiffSummary.mockResolvedValue({
        fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
      })
    })

    it('retries a provider rejection through the scheduler with the same delivery key', async () => {
      // Exercise the installed SDK's HTTP error contract without sending mail.
      const providerFetch = vi.fn()
        .mockResolvedValueOnce(new Response(JSON.stringify({
          name: 'rate_limit_exceeded', message: 'Too many requests',
        }), { status: 429, headers: { 'content-type': 'application/json' } }))
        .mockResolvedValueOnce(new Response(JSON.stringify({ id: 'email-accepted' }), {
          status: 200, headers: { 'content-type': 'application/json' },
        }))
      vi.stubGlobal('fetch', providerFetch)
      const provider = new Resend('re_test_not_a_real_key')
      mocks.sendEmail.mockImplementation((...args: Parameters<typeof provider.emails.send>) =>
        provider.emails.send(...args))
      mocks.auditFindMany.mockResolvedValue([{ id: 'child-1', parentId: 'parent-1' }])
      const child = await mocks.auditFindUnique()
      mocks.auditUpdate.mockImplementation(async ({ data }) => Object.assign(child, data))

      await notifyWatchRegression('parent-1', 'child-1')

      expect(child.watchNotificationStatus).toBe('FAILED')
      expect(child.watchNotificationLastError).toBe('Too many requests')
      expect(child.watchNotifiedAt).toBeUndefined()
      expect(mocks.recordSiteLifecycleEvent).not.toHaveBeenCalled()

      expect(await retryPendingWatchNotifications()).toBe(1)

      expect(child.watchNotificationStatus).toBe('SENT')
      expect(child.watchNotifiedAt).toBeInstanceOf(Date)
      expect(child.watchNotificationLastError).toBeNull()
      expect(mocks.recordSiteLifecycleEvent).toHaveBeenCalledTimes(1)
      expect(providerFetch).toHaveBeenCalledTimes(2)
      for (const [, request] of providerFetch.mock.calls) {
        expect(new Headers(request.headers).get('Idempotency-Key')).toBe('fixflags-watch-child-1-v1')
      }
      // Undelivered alerts stay eligible, and the attempt bound still caps
      // retries so a permanently failing notification cannot loop forever.
      const sweepWhere = mocks.auditFindMany.mock.calls[0]?.[0]?.where
      expect(sweepWhere).toMatchObject({
        OR: [
          {
            watchNotificationStatus: { in: ['PENDING', 'FAILED'] },
            watchNotificationAttempts: { lt: 5 },
          },
          {
            watchNotificationStatus: 'SENDING',
            watchNotificationLeaseUntil: expect.anything(),
          },
        ],
      })
      expect(sweepWhere.watchNotificationAttempts).toBeUndefined()
    })

    it('keeps an accepted notification sent when lifecycle telemetry fails', async () => {
      mocks.recordSiteLifecycleEvent.mockRejectedValue(new Error('Analytics unavailable'))

      await expect(notifyWatchRegression('parent-1', 'child-1')).resolves.toBeUndefined()

      expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ watchNotificationStatus: 'SENT' }),
      }))
      expect(mocks.auditUpdate).not.toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ watchNotificationStatus: 'FAILED' }),
      }))
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    })

    it('does not record a malformed success response as sent', async () => {
      mocks.sendEmail.mockResolvedValue({ data: null, error: null })

      await notifyWatchRegression('parent-1', 'child-1')

      expect(mocks.auditUpdate).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ watchNotificationStatus: 'FAILED' }),
      }))
      expect(mocks.recordSiteLifecycleEvent).not.toHaveBeenCalled()
    })

    it('continues retrying other Sites when one notification cannot be loaded', async () => {
      mocks.auditFindMany.mockResolvedValue([
        { id: 'broken-child', parentId: 'broken-parent' },
        { id: 'child-1', parentId: 'parent-1' },
      ])
      mocks.auditFindUnique.mockRejectedValueOnce(new Error('Audit unavailable'))

      await expect(retryPendingWatchNotifications()).resolves.toBe(2)

      expect(mocks.auditFindUnique).toHaveBeenCalledWith({
        where: { id: 'child-1' }, select: expect.any(Object),
      })
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
      expect(mocks.recordSiteLifecycleEvent).toHaveBeenCalledTimes(1)
    })
  })

  describe('interrupted claim recovery', () => {
    // A worker that dies after claiming SENDING but before persisting a terminal
    // status leaves the alert in a state no retry can see. The customer would
    // never learn their Site regressed, which breaks the promise that FixFlags
    // watches while unattended.
    const strandedChild = {
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH' as const,
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: 1,
      watchNotificationStatus: 'SENDING' as const,
      watchNotificationAttempts: 1,
      watchNotificationClaimedAt: new Date('2026-07-22T12:00:00.000Z'),
      user: { email: 'owner@example.test', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' as const },
    }

    beforeEach(() => {
      mocks.auditFindUnique.mockResolvedValue(strandedChild)
      mocks.getFlagDiffSummary.mockResolvedValue({
        fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
      })
    })

    it('makes an expired SENDING claim eligible again for retry', async () => {
      mocks.auditFindMany.mockResolvedValue([{ id: 'child-1', parentId: 'parent-1' }])

      await retryPendingWatchNotifications()

      // The sweep must actually be able to see a stranded SENDING row, and only
      // once its lease has expired.
      const sweepWhere = mocks.auditFindMany.mock.calls[0]?.[0]?.where
      expect(sweepWhere).toMatchObject({
        OR: [
          { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
          {
            watchNotificationStatus: 'SENDING',
            watchNotificationLeaseUntil: { lt: expect.any(Date) },
          },
        ],
      })
    })

    it('re-sends and records SENT for a claim abandoned by a dead worker', async () => {
      const row = { ...strandedChild }
      // Honour the where clause like a real updateMany would, otherwise the
      // mock would let a claim succeed that the database would reject.
      mocks.auditUpdateMany.mockImplementation(async ({ where, data }) => {
        const allowed = where?.watchNotificationStatus?.in
        if (Array.isArray(allowed) && !allowed.includes(row.watchNotificationStatus)) {
          return { count: 0 }
        }
        if (where?.watchNotificationAttempts?.lt !== undefined
          && row.watchNotificationAttempts >= where.watchNotificationAttempts.lt) {
          return { count: 0 }
        }
        Object.assign(row, data)
        return { count: 1 }
      })
      mocks.auditUpdate.mockImplementation(async ({ data }) => Object.assign(row, data))

      await notifyWatchRegression('parent-1', 'child-1')

      // Reclaimed, so the alert actually goes out instead of being suppressed.
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
      expect(row.watchNotificationStatus).toBe('SENT')
      expect(row.watchNotifiedAt).toBeInstanceOf(Date)
      // The delivery key stays stable so a reclaim cannot double-send.
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'owner@example.test' }),
        { idempotencyKey: 'fixflags-watch-child-1-v1' }
      )
    })

    it('leaves a SENDING claim alone while its lease is still valid', async () => {
      // A second worker must never steal a claim that is still in flight.
      mocks.auditFindUnique.mockResolvedValue({
        ...strandedChild,
        watchNotificationLeaseUntil: new Date(Date.now() + 60_000),
      })
      mocks.auditFindMany.mockResolvedValue([{ id: 'child-1', parentId: 'parent-1' }])

      await retryPendingWatchNotifications()

      expect(mocks.auditUpdateMany).not.toHaveBeenCalled()
      expect(mocks.sendEmail).not.toHaveBeenCalled()
      // Nothing marked this alert failed while another worker still owned it.
      expect(mocks.auditUpdate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ watchNotificationStatus: 'FAILED' }),
        })
      )
    })

    it('terminalizes an expired final claim without risking a sixth send', async () => {
      const expired = new Date(Date.now() - 60_000)
      mocks.auditFindUnique.mockResolvedValue({
        ...strandedChild,
        watchNotificationAttempts: 5,
        watchNotificationLeaseUntil: expired,
      })

      await notifyWatchRegression('parent-1', 'child-1')

      expect(mocks.sendEmail).not.toHaveBeenCalled()
      expect(mocks.auditUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'child-1',
          watchNotificationStatus: 'SENDING',
          watchNotificationAttempts: { gte: 5 },
          watchNotificationLeaseUntil: { lte: expect.any(Date) },
        },
        data: {
          watchNotificationStatus: 'FAILED',
          watchNotificationLastError: 'Delivery confirmation expired after the final attempt',
          watchNotificationLeaseUntil: null,
        },
      })
      const claim = mocks.auditUpdateMany.mock.calls.find(([call]) =>
        call.data?.watchNotificationAttempts?.increment === 1
      )
      expect(claim).toBeUndefined()
    })

    it('makes the lease a condition of the claim, so the database is the authority', async () => {
      // The read-time guard is only an optimisation. Concurrency safety has to
      // live in the claim itself, or two workers racing on the same alert would
      // both believe they own the delivery.
      await notifyWatchRegression('parent-1', 'child-1')

      const claimWhere = mocks.auditUpdateMany.mock.calls[0]?.[0]?.where
      expect(claimWhere).toMatchObject({
        OR: [
          { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
          {
            watchNotificationStatus: 'SENDING',
            watchNotificationLeaseUntil: { lt: expect.any(Date) },
          },
        ],
        watchNotificationAttempts: { lt: 5 },
      })
      // Every claim takes a lease, and every terminal outcome releases it.
      expect(mocks.auditUpdateMany.mock.calls[0]?.[0]?.data)
        .toMatchObject({ watchNotificationLeaseUntil: expect.any(Date) })
      for (const [call] of mocks.auditUpdate.mock.calls) {
        expect(call.data).toMatchObject({ watchNotificationLeaseUntil: null })
      }
    })
  })
})
