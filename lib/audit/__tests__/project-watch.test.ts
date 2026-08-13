import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectUpdate: vi.fn(),
  projectUpdateMany: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  auditUpdateMany: vi.fn(),
  auditUpdate: vi.fn(),
  startMonitoringAudit: vi.fn(),
  canAccessProductWatch: vi.fn(),
  getFlagDiffSummary: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: mocks.projectFindMany,
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
vi.mock('@/lib/auth/entitlements', () => ({
  canAccessProductWatch: mocks.canAccessProductWatch,
  canSharePublicly: vi.fn(() => true),
}))
vi.mock('@/lib/audit/diff-flags', () => ({ getFlagDiffSummary: mocks.getFlagDiffSummary }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: mocks.sendEmail } } }))

import { notifyWatchRegression, processDueProjectWatches } from '@/lib/audit/project-watch'

const project = {
  id: 'project-1',
  userId: 'user-1',
  watchInterval: 'WEEKLY',
  watchNextRunAt: new Date('2026-07-22T10:00:00.000Z'),
  watchConsecutiveFailures: 0,
  user: { id: 'user-1', plan: 'BUILDER', role: 'user', subscriptionStatus: 'ACTIVE' },
}

describe('Product Watch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectFindMany.mockResolvedValue([project])
    mocks.projectUpdate.mockResolvedValue(project)
    mocks.projectUpdateMany.mockResolvedValue({ count: 1 })
    mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
    mocks.sendEmail.mockResolvedValue({ id: 'email-1' })
    mocks.canAccessProductWatch.mockReturnValue(true)
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

  it('turns watch off when the live entitlement is gone', async () => {
    mocks.canAccessProductWatch.mockReturnValue(false)

    await processDueProjectWatches()

    expect(mocks.projectUpdate).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        watchInterval: null,
        watchNextRunAt: null,
        watchLeaseUntil: null,
        watchLastError: 'Product Watch disabled after entitlement loss',
      },
    })
    expect(mocks.startMonitoringAudit).not.toHaveBeenCalled()
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
