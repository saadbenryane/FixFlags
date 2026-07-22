import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectUpdate: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  auditUpdateMany: vi.fn(),
  startMonitoringAudit: vi.fn(),
  canAccessProductWatch: vi.fn(),
  getFlagDiffSummary: vi.fn(),
  sendEmail: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findMany: mocks.projectFindMany, update: mocks.projectUpdate },
    audit: {
      findFirst: mocks.auditFindFirst,
      findUnique: mocks.auditFindUnique,
      updateMany: mocks.auditUpdateMany,
    },
  },
}))
vi.mock('@/lib/audit/monitoring', () => ({ startMonitoringAudit: mocks.startMonitoringAudit }))
vi.mock('@/lib/auth/entitlements', () => ({
  canAccessProductWatch: mocks.canAccessProductWatch,
}))
vi.mock('@/lib/audit/diff-flags', () => ({ getFlagDiffSummary: mocks.getFlagDiffSummary }))
vi.mock('@/lib/email/client', () => ({ resend: { emails: { send: mocks.sendEmail } } }))

import { notifyWatchRegression, processDueProjectWatches } from '@/lib/audit/project-watch'

const project = {
  id: 'project-1',
  userId: 'user-1',
  url: 'https://example.com/',
  watchInterval: 'weekly',
  user: { id: 'user-1', plan: 'BUILDER', role: 'user', subscriptionStatus: 'ACTIVE' },
}

describe('Product Watch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.projectFindMany.mockResolvedValue([project])
    mocks.projectUpdate.mockResolvedValue(project)
    mocks.canAccessProductWatch.mockReturnValue(true)
  })

  it('does not enqueue an overlapping scheduled re-check', async () => {
    mocks.auditFindFirst
      .mockResolvedValueOnce({ id: 'parent-1' })
      .mockResolvedValueOnce({ id: 'active-child' })

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
      data: { watchInterval: null, watchNextRunAt: null },
    })
    expect(mocks.startMonitoringAudit).not.toHaveBeenCalled()
  })

  it('sends at most one regression notification per child report', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      id: 'child-1',
      url: 'https://example.com/',
      projectId: 'project-1',
      user: { email: 'owner@example.com', name: 'Owner' },
      project: { watchInterval: 'weekly' },
    })
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [], unchanged: [], newIssues: [{ id: 'new' }], regressed: [],
    })
    mocks.auditUpdateMany.mockResolvedValue({ count: 0 })

    await notifyWatchRegression('parent-1', 'child-1')

    expect(mocks.sendEmail).not.toHaveBeenCalled()
  })
})
