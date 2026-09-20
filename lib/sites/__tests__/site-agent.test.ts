import { beforeEach, describe, expect, it, vi } from 'vitest'

const projectFindFirst = vi.hoisted(() => vi.fn())
const threadFindFirst = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findFirst: projectFindFirst },
    siteAgentThread: { findFirst: threadFindFirst },
  },
}))

vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn() }))

import { getSiteAgentHistory, SiteAgentError } from '@/lib/sites/application/agent'

describe('Site Agent tenant boundary', () => {
  beforeEach(() => {
    projectFindFirst.mockReset()
    threadFindFirst.mockReset()
  })

  it('uses Site id and authenticated owner together and does not reveal another tenant', async () => {
    projectFindFirst.mockResolvedValue(null)

    await expect(getSiteAgentHistory({ siteId: 'site-a', userId: 'user-b' }))
      .rejects.toMatchObject<Partial<SiteAgentError>>({ message: 'Site not found', status: 404 })
    expect(projectFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'site-a', userId: 'user-b', deletedAt: null },
    }))
    expect(threadFindFirst).not.toHaveBeenCalled()
  })
})
