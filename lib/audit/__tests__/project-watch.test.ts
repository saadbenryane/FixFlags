import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectUpdate: vi.fn(),
  projectUpdateMany: vi.fn(),
  projectFindFirst: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  auditUpdateMany: vi.fn(),
  auditUpdate: vi.fn(),
  startMonitoringAudit: vi.fn(),
  getFlagDiffSummary: vi.fn(),
  sendEmail: vi.fn(),
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
      updateMany: mocks.auditUpdateMany,
      update: mocks.auditUpdate,
    },
  },
}))
vi.mock('@/lib/audit/monitoring', () => ({ startMonitoringAudit: mocks.startMonitoringAudit }))
vi.mock('@/lib/audit/diff-flags', () => ({ getFlagDiffSummary: mocks.getFlagDiffSummary }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: mocks.sendEmail } } }))

import {
  notifyWatchRegression,
  processDueProjectWatches,
  setProjectWatch,
} from '@/lib/audit/project-watch'

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
    vi.clearAllMocks()
    vi.stubEnv('REDIS_URL', 'redis://watch.test')
    vi.stubEnv('RESEND_API_KEY', 're_watch_test')
    vi.stubEnv('RESEND_FROM_EMAIL', 'watch@example.test')
    mocks.projectFindMany.mockResolvedValue([project])
    mocks.projectUpdate.mockResolvedValue(project)
    mocks.projectUpdateMany.mockResolvedValue({ count: 1 })
    mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
    mocks.sendEmail.mockResolvedValue({ id: 'email-1' })
    mocks.projectFindFirst.mockResolvedValue({ id: 'project-1', user: project.user })
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

  it('does not enable a schedule outside Studio', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      id: 'project-1',
      user: { ...project.user, plan: 'BUILDER' },
    })

    const result = await setProjectWatch({
      projectId: 'project-1',
      userId: 'user-1',
      interval: 'weekly',
    })

    expect(result).toEqual({
      ok: false,
      error: 'Scheduled reviews are available on Studio.',
      code: 'STUDIO_REQUIRED',
    })
    expect(mocks.projectUpdate).not.toHaveBeenCalled()
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
    mocks.auditFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'parent-1' })
    mocks.startMonitoringAudit.mockResolvedValue({ ok: true, auditId: 'child-1' })

    const result = await processDueProjectWatches()

    expect(result).toEqual({ processed: 1, enqueued: 1, errors: 0 })
    expect(mocks.projectFindMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.not.objectContaining({ isManaged: expect.anything() }),
    }))
    expect(mocks.startMonitoringAudit).toHaveBeenCalledWith(
      'parent-1',
      project.user,
      { trigger: 'WATCH' }
    )
  })

  it('does not enqueue an overlapping scheduled re-check', async () => {
    mocks.auditFindFirst.mockResolvedValueOnce({ id: 'active-child' })

    const result = await processDueProjectWatches()

    expect(result).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(mocks.startMonitoringAudit).not.toHaveBeenCalled()
    expect(mocks.projectUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'project-1' },
      data: expect.objectContaining({ watchNextRunAt: expect.any(Date) }),
    }))
  })

  it('pauses at the renewal boundary when monthly Review capacity is exhausted', async () => {
    const renewalAt = new Date('2026-09-01T00:00:00.000Z')
    mocks.auditFindFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'parent-1' })
    mocks.startMonitoringAudit.mockRejectedValue(
      Object.assign(new Error('Monthly Review allowance used'), {
        code: 'UPGRADE_REQUIRED',
        renewalAt,
      })
    )

    const result = await processDueProjectWatches()

    expect(result).toEqual({ processed: 1, enqueued: 0, errors: 0 })
    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        watchLeaseUntil: null,
        watchNextRunAt: renewalAt,
        watchLastError:
          'Watch paused because this month’s Product Review allowance is used. It will resume after renewal or an upgrade.',
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
})
