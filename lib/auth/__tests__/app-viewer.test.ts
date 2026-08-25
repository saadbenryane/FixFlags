import { describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())
const prismaUserFindUnique = vi.hoisted(() => vi.fn())
const getCheckUsage = vi.hoisted(() => vi.fn())
const isAdminUser = vi.hoisted(() => vi.fn())
const refreshUserUsagePeriod = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession } },
}))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: prismaUserFindUnique } } }))
vi.mock('@/lib/auth/permissions', () => ({ getCheckUsage, isAdminUser, isDevUnlimitedScans: () => false }))
vi.mock('@/lib/billing/usage-period', () => ({ refreshUserUsagePeriod }))

import { getAppMeUser, getAppViewer } from '@/lib/auth/app-viewer'

const viewerUser = {
  id: 'user-1',
  email: 'owner@example.com',
  name: 'Owner',
  plan: 'FREE',
  role: 'user',
  auditsUsed: 0,
  auditsLimit: 3,
  deepReviewsUsed: 0,
  deepReviewsLimit: 1,
  usagePeriodStart: new Date('2026-08-01T00:00:00.000Z'),
  usagePeriodEnd: new Date('2026-09-01T00:00:00.000Z'),
  subscriptionStatus: 'NONE',
  vibecodingLevel: null,
  preferredTools: [],
}

describe('getAppViewer', () => {
  it('returns null when there is no session', async () => {
    getSession.mockResolvedValueOnce(null)
    await expect(getAppViewer()).resolves.toBeNull()
    expect(prismaUserFindUnique).not.toHaveBeenCalled()
  })

  it('returns null when the session user is missing from the database', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'ghost' } })
    prismaUserFindUnique.mockResolvedValueOnce(null)
    await expect(getAppViewer()).resolves.toBeNull()
  })

  it('returns the session and user for a valid session', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'user-1', email: 'owner@example.com' } })
    prismaUserFindUnique.mockResolvedValueOnce(viewerUser)

    const viewer = await getAppViewer()
    expect(viewer?.user.id).toBe('user-1')
    expect(viewer?.session.user.id).toBe('user-1')
  })

  it('tolerates a session lookup failure', async () => {
    getSession.mockRejectedValueOnce(new Error('session backend down'))
    await expect(getAppViewer()).resolves.toBeNull()
  })
})

describe('getAppMeUser', () => {
  it('returns null when there is no viewer', async () => {
    getSession.mockResolvedValueOnce(null)
    await expect(getAppMeUser()).resolves.toBeNull()
  })

  it('serializes the viewer for the app shell', async () => {
    getSession.mockResolvedValueOnce({ user: { id: 'user-1' } })
    prismaUserFindUnique.mockResolvedValueOnce(viewerUser)
    getCheckUsage.mockResolvedValue({ used: 0, pending: 0, limit: 3, isUnlimited: false })
    refreshUserUsagePeriod.mockResolvedValue(null)
    isAdminUser.mockReturnValue(false)

    const me = await getAppMeUser()
    expect(me?.id).toBe('user-1')
    expect(me?.plan).toBe('FREE')
    expect(me?.entitlements.canMonitor).toBe(true)
  })
})
