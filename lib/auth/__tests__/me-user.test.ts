import { describe, expect, it, vi } from 'vitest'

const getCheckUsage = vi.hoisted(() => vi.fn())
const isAdminUser = vi.hoisted(() => vi.fn())

vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth/permissions', () => ({ getCheckUsage, isAdminUser, isDevUnlimitedScans: () => false }))

import { serializeMeUser } from '@/lib/auth/me-user'

const baseUser = {
  id: 'user-1',
  email: 'owner@example.com',
  name: 'Owner',
  plan: 'BUILDER' as const,
  role: 'user',
  auditsUsed: 2,
  auditsLimit: 25,
  subscriptionStatus: 'ACTIVE' as const,
  vibecodingLevel: null,
  preferredTools: [],
}

const checks = { used: 2, pending: 0, limit: 25, isUnlimited: false }

describe('serializeMeUser', () => {
  it('serializes the user with usage and entitlements', async () => {
    getCheckUsage.mockResolvedValue(checks)
    isAdminUser.mockReturnValue(false)

    const me = await serializeMeUser(baseUser)
    expect(me.id).toBe('user-1')
    expect(me.email).toBe('owner@example.com')
    expect(me.plan).toBe('BUILDER')
    expect(me.isAdmin).toBe(false)
    expect(me.checks).toEqual(checks)
    expect(me.entitlements.canAccessPaidFeatures).toBe(true)
    expect(me.entitlements.canMonitor).toBe(true)
  })

  it('falls back to the session identity when account fields are missing', async () => {
    getCheckUsage.mockResolvedValue(checks)
    isAdminUser.mockReturnValue(false)

    const me = await serializeMeUser(
      {
        ...baseUser,
        email: null,
        name: null,
        plan: null,
        vibecodingLevel: 'builder',
      } as never,
      { email: 'session@example.com', name: 'Session Name' }
    )
    expect(me.email).toBe('session@example.com')
    expect(me.name).toBe('Session Name')
    expect(me.plan).toBe('FREE')
    expect(me.vibecodingLevel).toBe('builder')
  })

  it('flags admins through isAdminUser', async () => {
    getCheckUsage.mockResolvedValue(checks)
    isAdminUser.mockReturnValue(true)

    const me = await serializeMeUser(baseUser)
    expect(me.isAdmin).toBe(true)
  })
})
