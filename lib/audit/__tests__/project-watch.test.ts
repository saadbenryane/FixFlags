import { setProjectWatch } from '@/lib/sites/application/monitoring-settings'
import { prisma } from '@/lib/db'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Resend } from 'resend'

const mocks = vi.hoisted(() => ({
  userFindUnique:vi.fn(),
  assertOperator: vi.fn(),
  projectFindMany: vi.fn(),
  projectUpdate: vi.fn(),
  projectUpdateMany: vi.fn(),
  projectFindFirst: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  auditFindMany: vi.fn(),
  auditUpdateMany: vi.fn(),
  requestScheduledSiteRun: vi.fn(),
  siteOutcomeFindMany: vi.fn(),
  siteOutcomeUpdateMany: vi.fn(),
  transaction: vi.fn(),
  getFlagDiffSummary: vi.fn(),
  sendEmail: vi.fn(),
  recordSiteLifecycleEvent: vi.fn(),
  initializeDefaultMonitoring: vi.fn(),
  ensureDefaultMonitoring: vi.fn(),
  refreshGoogleContext: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: mocks.transaction,
    user:{findUnique:mocks.userFindUnique},
    project: {
      findMany: mocks.projectFindMany,
      findFirst: mocks.projectFindFirst,
      update: mocks.projectUpdate,
      updateMany: mocks.projectUpdateMany,
    },
    audit: {
      fields:{watchNotificationAttemptCeiling:'ceiling-field'},
      findFirst: mocks.auditFindFirst,
      findUnique: mocks.auditFindUnique,
      findMany: mocks.auditFindMany,
      updateMany: mocks.auditUpdateMany,
    },
    siteOutcome: { findMany: mocks.siteOutcomeFindMany, updateMany: mocks.siteOutcomeUpdateMany },
  },
}))
vi.mock('@/lib/admin/domain-actor', () => ({ assertAdminDomainActor: mocks.assertOperator }))
vi.mock('@/lib/sites/application/scheduled-runs', () => ({
  requestScheduledSiteRun: mocks.requestScheduledSiteRun,
}))
vi.mock('@/lib/sites/application/default-monitoring', () => ({ initializeDefaultMonitoring: mocks.initializeDefaultMonitoring,
  ensureDefaultMonitoring: mocks.ensureDefaultMonitoring }))
vi.mock('@/lib/billing/product-transaction', () => ({ productTransaction: (operation: (tx: object) => unknown) => operation({}) }))
vi.mock('@/lib/audit/diff-flags', () => ({ getFlagDiffSummary: mocks.getFlagDiffSummary }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: mocks.sendEmail } } }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: mocks.recordSiteLifecycleEvent }))
vi.mock('@/lib/sites/connections/google', () => ({ refreshDueGoogleContexts: mocks.refreshGoogleContext }))

import {
  classifyWatchResult,
  notifyWatchRegression,
  processDueProjectWatches,
  retryPendingWatchNotifications,
} from '@/lib/audit/project-watch'
import { fixedClock } from '@/lib/time/clock'

const project = {
  id: 'project-1',
  userId: 'user-1',
  watchInterval: 'WEEKLY',
  watchNextRunAt: new Date('2026-07-22T10:00:00.000Z'),
  watchConsecutiveFailures: 0,
  user: { lifecycleStatus:'ACTIVE',entitlementGrants:[],licensedSiteQuantity:0,auditsLimit:3,deepReviewsLimit:1,id: 'user-1', plan: 'TEAM', role: 'user', subscriptionStatus: 'ACTIVE' },
}

function completedWatch<T extends { project?: Record<string, unknown> } & Record<string, unknown>>(row: T) {
  return {
    userId: 'user-1', status: 'COMPLETED' as const,
    completedAt: new Date('2026-07-22T12:00:00Z'), improvementProjectedAt: new Date('2026-07-22T12:00:01Z'),
    ...row,
    project: { userId: 'user-1', deletedAt: null, ...row.project },
  }
}

describe('Product Watch', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.stubEnv('REDIS_URL', 'redis://watch.test')
    vi.stubEnv('RESEND_API_KEY', 're_watch_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'watch@example.test')
    mocks.userFindUnique.mockImplementation(async()=>{const first=await mocks.projectFindFirst.mock.results.at(-1)?.value;const many=await mocks.projectFindMany.mock.results.at(-1)?.value;return {...project.user,...(many?.[0]?.user??{}),...(first?.user??{})}})
    mocks.projectFindMany.mockResolvedValue([project])
    mocks.projectUpdate.mockResolvedValue(project)
    mocks.projectUpdateMany.mockResolvedValue({ count: 1 })
    mocks.siteOutcomeUpdateMany.mockResolvedValue({ count: 1 })
    mocks.transaction.mockImplementation(async (operations: Array<Promise<unknown>> | ((tx: unknown) => unknown)) => typeof operations === 'function' ? operations(prisma) : Promise.all(operations))
    mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
    mocks.sendEmail.mockResolvedValue({ data: { id: 'email-1' }, error: null })
    mocks.projectFindFirst.mockResolvedValue({ ...project, watchEveryMinutes: null })
    mocks.siteOutcomeFindMany.mockResolvedValue([])
    mocks.requestScheduledSiteRun.mockResolvedValue({ runId: 'run-1', auditId: 'child-1', reused: false })
    mocks.refreshGoogleContext.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('retains the operator grant through scheduled admission', async () => {
    const operator = { kind: 'admin' as const, actorId: 'operator', operationId: 'operation' }
    await processDueProjectWatches(1, { clock: fixedClock(new Date('2026-07-22T12:00:00Z')), onlyProjectId: project.id, operator })
    expect(mocks.assertOperator).toHaveBeenCalledWith(operator, project.userId, project.id)
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ operator }))
  })

  it('refuses an unscoped operator sweep before default setup or scheduling', async () => {
    const operator = { kind: 'admin' as const, actorId: 'operator', operationId: 'operation' }
    await expect(processDueProjectWatches(1, { operator })).rejects.toMatchObject({ code: 'ADMIN_DOMAIN_SCOPE_DENIED' })
    expect(mocks.initializeDefaultMonitoring).not.toHaveBeenCalled()
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled()
  })

  it('refuses revoked operator authority before changing monitoring state', async () => {
    const operator = { kind: 'admin' as const, actorId: 'operator', operationId: 'operation' }
    mocks.assertOperator.mockRejectedValue(new Error('Revoked operator'))
    await expect(processDueProjectWatches(1, { onlyProjectId: project.id, operator })).rejects.toThrow('Revoked operator')
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled()
    expect(mocks.requestScheduledSiteRun).not.toHaveBeenCalled()
  })

  it('enables weekly scheduled reviews for a Studio Product', async () => {
    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'weekly',
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'project-1', userId: 'user-1' }),
      data: expect.objectContaining({ watchInterval: 'WEEKLY' }),
    }))
  })

  it('keeps scheduling available when notification delivery is unavailable', async () => {
    vi.stubEnv('RESEND_API_KEY', '')
    vi.stubEnv('RESEND_FROM_EMAIL', '')
    expect(await setProjectWatch({ projectId: 'project-1', userId: 'user-1', interval: 'weekly' })).toEqual({ ok: true })
  })

  it('admits the next due Site and saves both schedules without waiting for Google context', async () => {
    mocks.projectFindMany.mockResolvedValue([project, { ...project, id: 'project-2' }])
    let finish!: () => void
    mocks.refreshGoogleContext.mockReturnValue(new Promise<void>(resolve => { finish = resolve }))
    const scheduling = processDueProjectWatches()
    try {
      await vi.waitFor(() => expect(mocks.requestScheduledSiteRun).toHaveBeenCalledTimes(2), { timeout: 200, interval: 10 })
      expect(await scheduling).toMatchObject({ enqueued: 2, errors: 0 })
      expect(mocks.projectUpdateMany.mock.calls.filter(([input]) => input.data.watchConsecutiveFailures === 0)).toHaveLength(2)
      expect(mocks.refreshGoogleContext).not.toHaveBeenCalled()
    } finally {
      finish()
      await scheduling
    }
  })

  it('retries a failed entitlement lookup without stopping the next due Site', async () => {
    const now = new Date('2026-10-11T09:00:00.000Z')
    mocks.projectFindMany.mockResolvedValue([project, { ...project, id: 'project-2', userId: 'user-2' }])
    mocks.userFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === project.userId) throw new Error('Account policy temporarily unavailable')
      return { ...project.user, id: 'user-2' }
    })
    expect(await processDueProjectWatches(20, { clock: fixedClock(now) })).toEqual({ processed: 1, enqueued: 1, errors: 1 })
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledTimes(1)
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-2', userId: 'user-2' }))
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: project.id, userId: project.userId, watchNextRunAt: project.watchNextRunAt }),
      data: expect.objectContaining({ watchNextRunAt: new Date('2026-10-11T09:15:00.000Z'), watchConsecutiveFailures: 1 }),
    }))
  })

  it('continues the due batch even when saving an earlier retry fails', async () => {
    mocks.projectFindMany.mockResolvedValue([project, { ...project, id: 'project-2', userId: 'user-2' }])
    mocks.userFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === project.userId) throw new Error('Account lookup failed')
      return { ...project.user, id: 'user-2' }
    })
    mocks.projectUpdateMany.mockImplementation(async ({ where }) => {
      if (where.id === project.id) throw new Error('This retry write failed')
      return { count: 1 }
    })
    expect(await processDueProjectWatches()).toEqual({ processed: 1, enqueued: 1, errors: 1 })
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-2' }))
  })

  it('uses each Site admission time after earlier work and policy lookup delay', async () => {
    const start = new Date('2026-10-11T09:00:00Z')
    let instant = start.getTime()
    mocks.projectFindMany.mockResolvedValue([project, { ...project, id: 'project-2', userId: 'user-2' }])
    mocks.userFindUnique.mockImplementation(async ({ where }) => {
      if (where.id === 'user-2') instant += 15 * 60_000
      return { ...project.user, id: where.id }
    })
    mocks.requestScheduledSiteRun.mockImplementation(async ({ projectId }) => {
      if (projectId === project.id) instant += 20 * 60_000
      return { runId: projectId, auditId: projectId, reused: false }
    })
    expect(await processDueProjectWatches(20, { clock: { now: () => new Date(instant) } })).toEqual({ processed: 2, enqueued: 2, errors: 0 })
    const admissions = mocks.requestScheduledSiteRun.mock.calls.map(([input]) => input)
    expect(admissions[1].now).toEqual(new Date(start.getTime() + 35 * 60_000))
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'project-2' }), data: { watchLeaseUntil: new Date(start.getTime() + 45 * 60_000) },
    }))
    expect(admissions[1].scheduledAt).toEqual(project.watchNextRunAt)
  })

  it.each(['failure', 'expired-renewal'])('schedules %s from the actual result time', async result => {
    const start = new Date('2026-10-11T09:00:00Z')
    let instant = start.getTime()
    mocks.projectFindMany.mockResolvedValue([{ ...project, watchInterval: 'HOURLY' }])
    mocks.requestScheduledSiteRun.mockImplementation(async () => {
      instant += 2 * 60 * 60_000
      throw Object.assign(new Error('Delayed admission failure'), result === 'expired-renewal'
        ? { code: 'TOKEN_LIMIT', renewalAt: new Date(start.getTime() + 60 * 60_000) } : {})
    })
    await processDueProjectWatches(20, { clock: { now: () => new Date(instant) } })
    const next = new Date(instant + (result === 'failure' ? 15 : 60) * 60_000)
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ watchNextRunAt: next }) }))
  })

  it('does not clear a replacement lease after the original worker finishes admission', async () => {
    const now = new Date('2026-10-11T09:00:00.000Z'), replacement = new Date('2026-10-11T09:30:00.000Z')
    let liveLease: Date | null = null
    mocks.projectUpdateMany.mockImplementation(async ({ where, data }) => {
      if (where.watchLeaseUntil && where.watchLeaseUntil.getTime() !== liveLease?.getTime()) return { count: 0 }
      if ('watchLeaseUntil' in data) liveLease = data.watchLeaseUntil
      return { count: 1 }
    })
    mocks.requestScheduledSiteRun.mockImplementation(async () => {
      liveLease = replacement
      return { runId: 'run-1', auditId: 'audit-1', reused: false }
    })
    await processDueProjectWatches(20, { clock: fixedClock(now) })
    expect(liveLease).toEqual(replacement)
    const completion = mocks.projectUpdateMany.mock.calls.find(([call]) => call.data.watchConsecutiveFailures === 0)![0]
    expect(completion.where).toMatchObject({ userId: project.userId, deletedAt: null,
      user: { lifecycleStatus: 'ACTIVE' }, watchLeaseUntil: new Date('2026-10-11T09:10:00.000Z') })
  })

  it.each([['hourly', undefined, 'HOURLY'], ['custom', 180, 'CUSTOM'], ['custom', 4320, 'CUSTOM']] as const)('saves %s monitoring with its duration', async (interval, everyMinutes, stored) => {
    expect(await setProjectWatch({ projectId: 'project-1', userId: 'user-1', interval, ...(everyMinutes ? { everyMinutes } : {}) })).toEqual({ ok: true })
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ watchInterval: stored, watchEveryMinutes: everyMinutes ?? null }) }))
  })

  it('rejects malformed custom timing and hourly monitoring on Free', async () => {
    expect(await setProjectWatch({ projectId: 'project-1', userId: 'user-1', interval: 'custom', everyMinutes: 0 })).toMatchObject({ ok: false, code: 'INVALID_INTERVAL' })
    mocks.projectFindFirst.mockResolvedValue({ ...project, user: { ...project.user, plan: 'FREE' } })
    expect(await setProjectWatch({ projectId: 'project-1', userId: 'user-1', interval: 'hourly' })).toMatchObject({ ok: false, code: 'INTERVAL_NOT_ALLOWED' })
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled()
  })

  it('advances a custom worker schedule by its saved duration', async () => {
    const now = new Date('2026-10-11T09:00:00.000Z')
    mocks.projectFindMany.mockResolvedValue([{ ...project, watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchNextRunAt: now }])
    mocks.auditFindFirst.mockResolvedValue(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'outcome-1' }])
    expect(await processDueProjectWatches(20, { clock: fixedClock(now) })).toMatchObject({ enqueued: 1 })
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({ interval: 'custom', everyMinutes: 180, now }))
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ watchNextRunAt: new Date('2026-10-11T12:00:00.000Z') }) }))
  })

  it('pauses hourly monitoring when the account no longer allows it', async () => {
    mocks.projectFindMany.mockResolvedValue([{ ...project, watchInterval: 'HOURLY', user: { ...project.user, plan: 'FREE' } }])
    expect(await processDueProjectWatches()).toEqual({ processed: 0, enqueued: 0, errors: 0 })
    expect(mocks.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ watchNextRunAt: null }) }))
  })

  it('preserves a schedule edited while its check is queued', async () => {
    const now = new Date('2026-10-11T09:00:00.000Z')
    const persisted = { everyMinutes: 180, nextRunAt: now }
    mocks.projectFindMany.mockResolvedValue([{ ...project, watchInterval: 'CUSTOM', watchEveryMinutes: 180, watchNextRunAt: now }])
    mocks.auditFindFirst.mockResolvedValue(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'outcome-1' }])
    mocks.projectUpdateMany.mockImplementation(async ({ where, data }) => {
      if (where.watchEveryMinutes !== persisted.everyMinutes || where.watchNextRunAt !== persisted.nextRunAt) return { count: 0 }
      if (data.watchNextRunAt) persisted.nextRunAt = data.watchNextRunAt
      return { count: 1 }
    })
    mocks.requestScheduledSiteRun.mockImplementation(async () => {
      persisted.everyMinutes = 4320
      persisted.nextRunAt = new Date('2026-10-14T09:00:00.000Z')
      return { runId: 'run-1', auditId: 'audit-1', reused: false }
    })
    await processDueProjectWatches(20, { clock: fixedClock(now) })
    expect(persisted).toEqual({ everyMinutes: 4320, nextRunAt: new Date('2026-10-14T09:00:00.000Z') })
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
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled()
  })

  it('pauses the schedule and returns Outcomes to manual freshness', async () => {
    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: null,
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'project-1' }),
      data: expect.objectContaining({
        watchNextRunAt: null,
        watchLastError: 'Paused. This Site is not on a check schedule.',
      }),
    }))
    expect(mocks.projectUpdateMany.mock.calls[0][0].data.watchInterval).toBeNull()
    expect(mocks.siteOutcomeUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { staleAfterMinutes: 11520 },
    }))
  })

  it('enables weekly watching on Free', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      id: 'project-1',
      user: { ...project.user, plan: 'FREE' },
      watchInterval: project.watchInterval,
    })

    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'weekly',
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdateMany).toHaveBeenCalled()
  })

  it('enables daily Watch on the same terms as weekly Watch', async () => {
    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'daily',
    })

    expect(result).toEqual({ ok: true })
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ watchInterval: 'DAILY', watchNextRunAt: expect.any(Date) }),
    }))
    expect(mocks.siteOutcomeUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      data: { staleAfterMinutes: 2160 },
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
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      interval: 'weekly',
      scheduledAt: project.watchNextRunAt,
    }))
  })

  it('does not enqueue an overlapping scheduled re-check', async () => {
    mocks.auditFindFirst.mockResolvedValueOnce({ id: 'active-child' })

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(mocks.requestScheduledSiteRun).not.toHaveBeenCalled()
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'project-1' }),
      data: expect.objectContaining({ watchNextRunAt: expect.any(Date) }),
    }))
  })

  it('delegates the original saved tick and cadence to scheduled Site care', async () => {
    mocks.auditFindFirst.mockResolvedValueOnce(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'signup-1' }, { id: 'checkout-1' }])

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(mocks.requestScheduledSiteRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      interval: 'weekly',
      userId: 'user-1',
      scheduledAt: project.watchNextRunAt,
    }))
  })


  it('pauses at the renewal boundary when monthly Review capacity is exhausted', async () => {
    const renewalAt = new Date('2026-09-01T00:00:00.000Z')
    mocks.auditFindFirst.mockResolvedValueOnce(null)
    mocks.siteOutcomeFindMany.mockResolvedValue([{ id: 'outcome-1' }])
    mocks.requestScheduledSiteRun.mockRejectedValue(
      Object.assign(new Error('Monthly Review allowance used'), {
        code: 'UPGRADE_REQUIRED',
        renewalAt,
      })
    )

    const result = await processDueProjectWatches(20, {
      clock: fixedClock(new Date('2026-08-25T00:00:00.000Z')),
    })

    expect(result).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(mocks.projectUpdateMany).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: 'project-1' }),
      data: {
        watchLeaseUntil: null,
        watchNextRunAt: renewalAt,
        watchLastError:
          'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
      },
    })
  })

  it('sends at most one regression notification per child report', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: 1,
      watchNotificationStatus: 'SENT',
      watchNotificationAttemptCeiling:5,watchNotificationAttempts: 1,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' },
    }))
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
    })
    mocks.auditUpdateMany.mockResolvedValue({ count: 0 })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it.each(['removed', 'suspended', 'other-owner'])('refuses an alert for a %s Site or account before delivery admission', async reason => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', userId: 'user-1', projectId: 'project-1', recheckTrigger: 'WATCH',
      user: { lifecycleStatus: reason === 'suspended' ? 'SUSPENDED' : 'ACTIVE', email: 'owner@example.com' },
      project: { userId: reason === 'other-owner' ? 'other' : 'user-1', deletedAt: reason === 'removed' ? new Date() : null } }))
    await notifyWatchRegression(null, 'child-1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.auditUpdateMany).not.toHaveBeenCalled()
    expect(mocks.getFlagDiffSummary).not.toHaveBeenCalled()
  })

  it('checks the current owner, recipient and preferences in the physical delivery claim', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', userId: 'user-1', projectId: 'project-1', url: 'https://example.com/',
      recheckTrigger: 'WATCH', completedAt: new Date(), watchRegressionCount: 1, watchRecoveryCount: 0,
      watchNotificationStatus: 'PENDING', watchNotificationAttempts: 0, watchNotificationAttemptCeiling: 5,
      user: { lifecycleStatus: 'ACTIVE', email: 'owner@example.com' },
      project: { userId: 'user-1', deletedAt: null, notificationLevel: 'FLAGS', notifyOnRecovery: true } }))
    mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: [{ id: 'new' }] })
    mocks.auditUpdateMany.mockResolvedValue({ count: 0 })
    await notifyWatchRegression(null, 'child-1')
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      status: 'COMPLETED', completedAt: expect.any(Date), improvementProjectedAt: { not: null },
      user: { lifecycleStatus: 'ACTIVE', email: 'owner@example.com' },
      project: { userId: 'user-1', deletedAt: null, user: { lifecycleStatus: 'ACTIVE' }, notificationLevel: 'FLAGS', notifyOnRecovery: true },
    }), data: expect.objectContaining({ watchNotificationStatus: 'SENDING' }) }))
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('excludes unavailable accounts and removed Sites before limiting the retry batch', async () => {
    mocks.auditFindMany.mockResolvedValue([])
    await retryPendingWatchNotifications(1)
    expect(mocks.auditFindMany).toHaveBeenCalledWith(expect.objectContaining({ take: 1, where: expect.objectContaining({
      user: { lifecycleStatus: 'ACTIVE' }, project: { deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
    }) }))
  })

  it('sends only for a measured regression with a stable idempotency key', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: null,
      watchNotificationStatus: null,
      watchNotificationAttemptCeiling:5,watchNotificationAttempts: 0,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' },
    }))
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
    })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'owner@example.com' }),
      expect.objectContaining({ idempotencyKey: 'fixflags-watch-child-1-v1', signal: expect.any(AbortSignal) })
    )
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'child-1', watchNotificationStatus: 'SENDING', watchNotificationAttempts: 1, watchNotificationLeaseUntil: expect.any(Date) }),
      data: expect.objectContaining({ watchNotificationStatus: 'SENT', watchNotificationProviderId: 'email-1' }),
    }))
  })

  it('records a clean watch result without sending email', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: null,
      watchNotificationStatus: null,
      watchNotificationAttemptCeiling:5,watchNotificationAttempts: 0,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' },
    }))
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [{ id: 'fixed' }], inconclusive: [], unchanged: [], newIssues: [], regressed: [],
    })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ id: 'child-1', watchNotificationStatus: { notIn: ['SENT', 'SENDING'] } }),
      data: {
        watchRegressionCount: 0,
        watchRecoveryCount: 1,
        watchNotificationStatus: 'NOT_APPLICABLE',
      },
    }))
  })

  it('persists a due alert without making a provider request or consuming an attempt', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', url: 'https://example.com/', projectId: 'project-1',
      improvementProjectedAt: null,
      recheckTrigger: 'WATCH', completedAt: new Date(), watchRegressionCount: null, watchRecoveryCount: null,
      watchNotificationStatus: 'NOT_APPLICABLE', watchNotificationAttemptCeiling:5,watchNotificationAttempts: 0,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com' }, project: { notificationLevel: 'FLAGS' } }))
    mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [], inconclusive: [], unchanged: [], regressed: [],
      newIssues: [{ checkId: 'title-missing', severity: 'IMPORTANT', confidence: 1, status: 'OPEN' }] })
    await classifyWatchResult(null, 'child-1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.auditUpdateMany).toHaveBeenCalledOnce()
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: {
      watchRegressionCount: 1, watchRecoveryCount: 0, watchNotificationStatus: 'PENDING',
    } }))
  })

  it.each(['QUEUED', 'CHECKING', 'FAILED', 'undated'])('refuses classification and delivery for an incomplete Watch: %s', async state => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', projectId: 'project-1', recheckTrigger: 'WATCH',
      status: state === 'undated' ? 'COMPLETED' : state, completedAt: state === 'undated' ? null : new Date(),
      user: { lifecycleStatus: 'ACTIVE', email: 'owner@example.com' } }))
    await classifyWatchResult(null, 'child-1')
    await notifyWatchRegression(null, 'child-1')
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled()
    expect(mocks.auditUpdateMany).not.toHaveBeenCalled()
    expect(mocks.getFlagDiffSummary).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('refuses direct delivery before the durable projection receipt', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', projectId: 'project-1', recheckTrigger: 'WATCH',
      improvementProjectedAt: null, user: { lifecycleStatus: 'ACTIVE', email: 'owner@example.com' } }))
    await notifyWatchRegression(null, 'child-1')
    expect(mocks.projectUpdateMany).not.toHaveBeenCalled()
    expect(mocks.auditUpdateMany).not.toHaveBeenCalled()
    expect(mocks.getFlagDiffSummary).not.toHaveBeenCalled()
    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })

  it('admits notification delivery only after the durable monitoring projection receipt', async () => {
    mocks.auditFindMany.mockResolvedValue([])
    await retryPendingWatchNotifications()
    expect(mocks.auditFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({
      improvementProjectedAt: { not: null },
    }) }))
  })

  it('combines simultaneous findings and recoveries into one branded provider request', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', url: 'https://example.com/', projectId: 'project-1',
      recheckTrigger: 'WATCH', completedAt: new Date('2026-10-13T00:00:00Z'),
      watchRegressionCount: null, watchNotificationStatus: 'PENDING', watchNotificationAttemptCeiling:5,watchNotificationAttempts: 0,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'WEEKLY', notificationLevel: 'FLAGS', notifyOnRecovery: true } }))
    const flag = { checkId: 'title-missing', severity: 'IMPORTANT', confidence: 0.95, status: 'OPEN', rubric: 'SEO' }
    mocks.getFlagDiffSummary.mockResolvedValue({
      newIssues: [{ ...flag, id: 'new', problem: 'Missing title' }],
      regressed: [{ ...flag, id: 'regressed', problem: 'Recurrent metadata failure' }],
      fixed: [{ ...flag, id: 'fixed', problem: 'Repaired title' }], unchanged: [], inconclusive: [],
    })
    await notifyWatchRegression('parent-1', 'child-1')
    expect(mocks.sendEmail).toHaveBeenCalledOnce()
    const message = mocks.sendEmail.mock.calls[0]![0]
    expect(message.subject).toBe('Needs attention on example.com: 2 Flags')
    for (const problem of ['Missing title', 'Recurrent metadata failure', 'Repaired title']) {
      expect(message.html).toContain(problem)
      expect(message.text).toContain(problem)
    }
    expect(message.html).toContain('/icon-192.png')
    expect(message.html).toContain('Recovery verified')
  })

  it('retries the recorded provider body even after names and templates change', async () => {
    const payload = { version: 1, from: 'FixFlags <hello@fixflags.com>', to: 'owner@example.com',
      subject: 'Recorded subject', html: '<p>Recorded evidence</p>', text: 'Recorded evidence',
      tags: [{ name: 'audit_id', value: 'child-1' }, { name: 'purpose', value: 'watch' }] }
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', url: 'https://example.com/', projectId: 'project-1',
      recheckTrigger: 'WATCH', completedAt: new Date(), watchRegressionCount: 1,
      watchNotificationStatus: 'FAILED', watchNotificationAttemptCeiling:5,watchNotificationAttempts: 1, watchNotificationPayload: payload,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Updated name' }, project: { watchInterval: 'WEEKLY' } }))
    mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [] })
    await notifyWatchRegression('parent-1', 'child-1')
    const { version, ...body } = payload
    void version
    expect(mocks.sendEmail).toHaveBeenCalledWith(body,
      expect.objectContaining({ idempotencyKey: 'fixflags-watch-child-1-v1' }))
  })

  it('does not send a recorded message to an address that the owner changed', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({ id: 'child-1', url: 'https://example.com/', projectId: 'project-1',
      recheckTrigger: 'WATCH', completedAt: new Date(), watchRegressionCount: 1,
      watchNotificationStatus: 'FAILED', watchNotificationAttemptCeiling:5,watchNotificationAttempts: 1,
      watchNotificationPayload: { version: 1, from: 'FixFlags <hello@fixflags.com>', to: 'old@example.com',
        subject: 'Recorded subject', html: '<p>Evidence</p>', text: 'Evidence', tags: [{ name: 'audit_id', value: 'child-1' }] },
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Owner' }, project: { watchInterval: 'WEEKLY' } }))
    mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [], inconclusive: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [] })
    await notifyWatchRegression('parent-1', 'child-1')
    expect(mocks.sendEmail).not.toHaveBeenCalled()
    expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      watchNotificationStatus: 'FAILED', watchNotificationLastError: 'Recorded notification no longer matches its recipient or Audit',
    }) }))
  })

  it('links a recovery notification to the parent Flag that holds its proof', async () => {
    mocks.auditFindUnique.mockResolvedValue(completedWatch({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH',
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: null,
      watchNotificationStatus: null,
      watchNotificationAttemptCeiling:5,watchNotificationAttempts: 0,
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.com', name: 'Owner' },
      project: {
        watchInterval: 'WEEKLY',
        notificationLevel: 'ALL',
        notifyOnRecovery: true,
      },
    }))
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
      expect.objectContaining({ idempotencyKey: 'fixflags-watch-child-1-v1', signal: expect.any(AbortSignal) })
    )
  })

  describe('customer notification selection', () => {
    const important = { id: 'important', checkId: 'title-missing', problem: 'Search title is missing', rubric: 'SEO', severity: 'IMPORTANT', confidence: 0.95, status: 'OPEN' }
    const critical = { ...important, id: 'critical', checkId: 'journey-checkout-failed', problem: 'Checkout <failed>', severity: 'CRITICAL' }
    beforeEach(() => {
      mocks.auditFindUnique.mockResolvedValue(completedWatch({
        id: 'child-1', url: 'https://example.com/', projectId: 'project-1',
        recheckTrigger: 'WATCH', completedAt: new Date('2026-10-10T12:00:00Z'),
        watchRegressionCount: 1, watchRecoveryCount: 0,
        watchNotificationStatus: 'FAILED', watchNotificationAttemptCeiling:5,watchNotificationAttempts: 1,
        user: { lifecycleStatus:'ACTIVE',email: 'owner@example.test', name: 'Owner <img src=x>' },
        project: { notificationLevel: 'CRITICAL_ONLY', notifyOnRecovery: true },
      }))
      mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [], inconclusive: [], unchanged: [], newIssues: [important, critical], regressed: [] })
    })

    it('links and explains the eligible critical Flag rather than an excluded finding', async () => {
      await notifyWatchRegression('parent-1', 'child-1')
      const message = mocks.sendEmail.mock.calls[0][0]
      expect(message.to).toBe('owner@example.test')
      expect(message.subject).toContain('1 Flag')
      expect(message.html).toContain('/flags/critical?')
      expect(message.html).not.toContain('/flags/important?')
      expect(message.html).toContain('Checkout &lt;failed&gt;')
      expect(message.html).toContain('Owner &lt;img src=x&gt;')
      expect(message.html).not.toContain('<img src=x>')
      expect(message.text).toContain('Checkout <failed>')
      expect(message.text).toContain('2026-10-10T12:00:00.000Z')
    })

    it.each(['critical-only', 'disable-recovery'] as const)('revises a recorded message after %s and preserves that retry body', async preference => {
      const child = await mocks.auditFindUnique()
      const recovered = { ...important, id: 'recovered', problem: 'Repaired navigation' }
      mocks.auditFindUnique.mockResolvedValue(completedWatch({ ...child, watchNotificationPayload: null,
        project: { notificationLevel: 'FLAGS', notifyOnRecovery: true } }))
      mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [recovered], inconclusive: [], unchanged: [],
        newIssues: [important, critical], regressed: [] })
      mocks.sendEmail.mockResolvedValue({ data: null, error: { message: 'Uncertain delivery' } })
      await notifyWatchRegression('parent-1', 'child-1')
      const firstPayload = mocks.auditUpdateMany.mock.calls.find(([input]) => input.data.watchNotificationPayload)![0].data.watchNotificationPayload
      const firstKey = mocks.sendEmail.mock.calls[0][1].idempotencyKey
      const settings = { notificationLevel: preference === 'critical-only' ? 'CRITICAL_ONLY' : 'FLAGS',
        notifyOnRecovery: preference !== 'disable-recovery' }
      mocks.auditFindUnique.mockResolvedValue(completedWatch({ ...child, watchNotificationAttempts: 2,
        watchNotificationPayload: firstPayload, project: settings }))
      await notifyWatchRegression('parent-1', 'child-1')
      const [revisedBody, revisedOptions] = mocks.sendEmail.mock.calls[1]
      expect(revisedOptions.idempotencyKey).not.toBe(firstKey)
      expect(revisedBody.html).toContain('/flags/critical?')
      expect(revisedBody.html).not.toContain(preference === 'critical-only' ? '/flags/important?' : '/flags/recovered?')
      const revisedSave = mocks.auditUpdateMany.mock.calls.filter(([input]) => input.data.watchNotificationPayload).at(-1)![0]
      expect(revisedSave.where.watchNotificationPayload).toEqual({ equals: firstPayload })
      const revisedPayload = revisedSave.data.watchNotificationPayload
      expect(revisedPayload.previous).toEqual([firstPayload])
      mocks.auditFindUnique.mockResolvedValue(completedWatch({ ...child, watchNotificationAttempts: 3,
        watchNotificationPayload: revisedPayload, project: settings,
        user: { ...child.user, name: 'Changed owner name' } }))
      mocks.sendEmail.mockResolvedValue({ data: { id: 'accepted' }, error: null })
      await notifyWatchRegression('parent-1', 'child-1')
      expect(mocks.sendEmail.mock.calls[2][0]).toEqual(revisedBody)
      expect(mocks.sendEmail.mock.calls[2][1].idempotencyKey).toBe(revisedOptions.idempotencyKey)
      expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
        watchNotificationStatus: 'SENT', watchNotificationProviderId: 'accepted',
      }) }))
    })

    it('respects an opt-out during retry, including recovery email', async () => {
      const child = await mocks.auditFindUnique()
      mocks.auditFindUnique.mockResolvedValue(completedWatch({ ...child, project: { notificationLevel: 'OFF', notifyOnRecovery: true } }))
      mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [critical], inconclusive: [], unchanged: [], newIssues: [critical], regressed: [] })
      await notifyWatchRegression('parent-1', 'child-1')
      expect(mocks.sendEmail).not.toHaveBeenCalled()
      expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ watchNotificationStatus: 'NOT_APPLICABLE' }) }))
    })

    it('does not notify low-confidence findings even when an older count was persisted', async () => {
      mocks.getFlagDiffSummary.mockResolvedValue({ fixed: [], inconclusive: [], unchanged: [], newIssues: [{ ...critical, confidence: 0.2 }], regressed: [] })
      await notifyWatchRegression('parent-1', 'child-1')
      expect(mocks.sendEmail).not.toHaveBeenCalled()
    })
  })

  describe('notification delivery truth', () => {
    beforeEach(() => {
      mocks.auditFindUnique.mockResolvedValue(completedWatch({
        id: 'child-1',
        url: 'https://example.com/',
        projectId: 'project-1',
        recheckTrigger: 'WATCH',
        completedAt: new Date('2026-07-22T12:00:00.000Z'),
        watchRegressionCount: 1,
        watchNotificationStatus: 'PENDING',
        watchNotificationAttemptCeiling:5,watchNotificationAttempts: 0,
        user: { lifecycleStatus:'ACTIVE',email: 'owner@example.test', name: 'Owner' },
        project: { watchInterval: 'WEEKLY' },
      }))
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
      mocks.auditFindUnique.mockImplementation(async () => structuredClone(child))
      mocks.auditUpdateMany.mockImplementation(async ({ data }) => {
        const next = { ...data }
        if (next.watchNotificationAttempts?.increment) next.watchNotificationAttempts = child.watchNotificationAttempts + next.watchNotificationAttempts.increment
        Object.assign(child, next)
        return { count: 1 }
      })

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
            watchNotificationAttempts: { lt: 'ceiling-field' },
          },
          {
            watchNotificationStatus: 'SENDING',
            OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: expect.any(Date) } }],
          },
        ],
      })
      expect(sweepWhere.watchNotificationAttempts).toBeUndefined()
    })

    it('aborts an unresponsive SDK HTTP call and leaves the alert retryable within the attempt bound', async () => {
      vi.useFakeTimers()
      try {
        let started!: () => void
        const admitted = new Promise<void>(resolve => { started = resolve })
        const providerFetch = vi.fn((_url: string, options: RequestInit) => new Promise<Response>((_resolve, reject) => {
          const signal = options.signal!
          signal.addEventListener('abort', () => reject(signal.reason), { once: true })
          started()
        }))
        vi.stubGlobal('fetch', providerFetch)
        const provider = new Resend('re_test_not_a_real_key')
        mocks.sendEmail.mockImplementation((...args: Parameters<typeof provider.emails.send>) => provider.emails.send(...args))
        const notification = notifyWatchRegression('parent-1', 'child-1')
        await admitted
        await vi.advanceTimersByTimeAsync(20_000)
        await notification
        expect(providerFetch.mock.calls[0][1].signal?.aborted).toBe(true)
        expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
          where: expect.objectContaining({ watchNotificationStatus: 'SENDING', watchNotificationAttempts: 1 }),
          data: expect.objectContaining({ watchNotificationStatus: 'FAILED', watchNotificationLeaseUntil: null }),
        }))
        expect(mocks.recordSiteLifecycleEvent).not.toHaveBeenCalled()
      } finally { vi.useRealTimers() }
    })

    it('keeps an accepted notification sent when lifecycle telemetry fails', async () => {
      mocks.recordSiteLifecycleEvent.mockRejectedValue(new Error('Analytics unavailable'))

      await expect(notifyWatchRegression('parent-1', 'child-1')).resolves.toBeUndefined()

      expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ watchNotificationStatus: 'SENT' }),
      }))
      expect(mocks.auditUpdateMany).not.toHaveBeenCalledWith(expect.objectContaining({
        data: expect.objectContaining({ watchNotificationStatus: 'FAILED' }),
      }))
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
    })

    it('does not record a malformed success response as sent', async () => {
      mocks.sendEmail.mockResolvedValue({ data: null, error: null })

      await notifyWatchRegression('parent-1', 'child-1')

      expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
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
    it('defers failed classification without consuming a provider attempt or rewriting a live sender', async () => {
      mocks.auditFindMany.mockResolvedValue([{ id: 'broken-child', parentId: null, watchNotificationAttempts: 2 }])
      mocks.auditFindUnique.mockRejectedValue(new Error('Invalid recorded comparison'))
      expect(await retryPendingWatchNotifications(1)).toBe(1)
      expect(mocks.auditUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
        where: expect.objectContaining({ id: 'broken-child', watchNotificationAttempts: 2,
          OR: [{ watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
            { watchNotificationStatus: 'SENDING', OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: expect.any(Date) } }] }] }),
        data: { updatedAt: expect.any(Date), watchNotificationLastError: 'Notification classification could not complete' },
      }))
      expect(mocks.sendEmail).not.toHaveBeenCalled()
    })
  })

  describe('interrupted claim recovery', () => {
    // A worker that dies after claiming SENDING but before persisting a terminal
    // status leaves the alert in a state no retry can see. The customer would
    // never learn their Site regressed, which breaks the promise that FixFlags
    // watches while unattended.
    const strandedChild = completedWatch({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      recheckTrigger: 'WATCH' as const,
      completedAt: new Date('2026-07-22T12:00:00.000Z'),
      watchRegressionCount: 1,
      watchNotificationStatus: 'SENDING' as const,
      watchNotificationAttemptCeiling:5,watchNotificationAttempts: 1,
      watchNotificationClaimedAt: new Date('2026-07-22T12:00:00.000Z'),
      user: { lifecycleStatus:'ACTIVE',email: 'owner@example.test', name: 'Owner' },
      project: { watchInterval: 'WEEKLY' as const },
    })

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
      // once its lease has expired or has no recorded owner.
      const sweepWhere = mocks.auditFindMany.mock.calls[0]?.[0]?.where
      expect(sweepWhere).toMatchObject({
        OR: [
          { watchNotificationStatus: { in: ['PENDING', 'FAILED'] } },
          {
            watchNotificationStatus: 'SENDING',
            OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: expect.any(Date) } }],
          },
        ],
      })
    })

    it('re-sends and records SENT for a claim abandoned by a dead worker', async () => {
      const row = { ...strandedChild, watchNotifiedAt: null as Date | null }
      mocks.auditFindUnique.mockImplementation(async () => structuredClone(row))
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
        const next = { ...data }
        if (next.watchNotificationAttempts?.increment) next.watchNotificationAttempts = row.watchNotificationAttempts + next.watchNotificationAttempts.increment
        Object.assign(row, next)
        return { count: 1 }
      })


      await notifyWatchRegression('parent-1', 'child-1')

      // Reclaimed, so the alert actually goes out instead of being suppressed.
      expect(mocks.sendEmail).toHaveBeenCalledTimes(1)
      expect(row.watchNotificationStatus).toBe('SENT')
      expect(row.watchNotifiedAt).toBeInstanceOf(Date)
      // The delivery key stays stable so a reclaim cannot double-send.
      expect(mocks.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({ to: 'owner@example.test' }),
        expect.objectContaining({ idempotencyKey: 'fixflags-watch-child-1-v1', signal: expect.any(AbortSignal) })
      )
    })

    it('leaves a SENDING claim alone while its lease is still valid', async () => {
      // A second worker must never steal a claim that is still in flight.
      mocks.auditFindUnique.mockResolvedValue(completedWatch({
        ...strandedChild,
        watchNotificationLeaseUntil: new Date(Date.now() + 60_000),
      }))
      mocks.auditFindMany.mockResolvedValue([{ id: 'child-1', parentId: 'parent-1' }])

      await retryPendingWatchNotifications()

      expect(mocks.auditUpdateMany).not.toHaveBeenCalled()
      expect(mocks.sendEmail).not.toHaveBeenCalled()
      // Nothing marked this alert failed while another worker still owned it.
      expect(mocks.auditUpdateMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ watchNotificationStatus: 'FAILED' }),
        })
      )
    })

    it.each([new Date(Date.now() - 60_000), null])('terminalizes an inactive final claim without risking a sixth send: %s', async expired => {
      mocks.auditFindUnique.mockResolvedValue(completedWatch({
        ...strandedChild,
        watchNotificationAttemptCeiling:5,watchNotificationAttempts: 5,
        watchNotificationLeaseUntil: expired,
      }))

      await notifyWatchRegression('parent-1', 'child-1')

      expect(mocks.sendEmail).not.toHaveBeenCalled()
      expect(mocks.auditUpdateMany).toHaveBeenCalledWith({
        where: {
          id: 'child-1',
          watchNotificationStatus: 'SENDING',
          watchNotificationAttempts: { gte: 5 },
          watchNotificationAttemptCeiling: 5,
          OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: expect.any(Date) } }],
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
            OR: [{ watchNotificationLeaseUntil: null }, { watchNotificationLeaseUntil: { lte: expect.any(Date) } }],
          },
        ],
        watchNotificationAttempts: { equals: 1, lt: 5 },
      })
      // Every claim takes a lease, and every terminal outcome releases it.
      expect(mocks.auditUpdateMany.mock.calls[0]?.[0]?.data)
        .toMatchObject({ watchNotificationLeaseUntil: expect.any(Date) })
      for (const [call] of mocks.auditUpdateMany.mock.calls.filter(([call]) => ['SENT', 'FAILED'].includes(call.data.watchNotificationStatus))) {
        expect(call.data).toMatchObject({ watchNotificationLeaseUntil: null })
        expect(call.where).toMatchObject({ watchNotificationStatus: 'SENDING', watchNotificationAttempts: 2, watchNotificationLeaseUntil: expect.any(Date) })
      }
    })
  })
})

// Retain post-beta subscription and quota contracts.
vi.mock('@/lib/billing/beta-policy', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/lib/billing/beta-policy')>(),
  OPEN_BETA_ACCESS: false, hasOpenBetaAccess: () => false,
}))
