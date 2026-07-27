import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { User } from '@prisma/client'

vi.mock('@/lib/auth/permissions', () => ({
  isAdminUser: vi.fn(),
  isDevUnlimitedScans: vi.fn(() => false),
}))

vi.mock('@/lib/db', () => ({
  prisma: { user: { findUnique: vi.fn() } },
}))

import { isAdminUser, isDevUnlimitedScans } from '@/lib/auth/permissions'
import { prisma } from '@/lib/db'
import {
  canAccessPaidFeatures,
  canSharePublicly,
  canExportSummary,
  canScanRepositories,
  canAccessProductWatch,
  canAccessCompare,
  canUseApiKeys,
  canAccessMonitoring,
  hasRevokedSubscriptionStatus,
  getEntitlements,
  getReportTierForUser,
  resolveReportTierForAudit,
} from '@/lib/auth/entitlements'

const mockedIsAdminUser = vi.mocked(isAdminUser)
const mockedIsDevUnlimitedScans = vi.mocked(isDevUnlimitedScans)
const mockedFindUnique = vi.mocked(prisma.user.findUnique)

type UserPick = Pick<User, 'id' | 'role' | 'plan' | 'subscriptionStatus'>

function makeUser(overrides: Partial<UserPick> = {}): UserPick {
  return {
    id: 'user-1',
    role: 'user',
    plan: 'FREE',
    subscriptionStatus: 'NONE',
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockedIsDevUnlimitedScans.mockReturnValue(false)
})

describe('hasRevokedSubscriptionStatus', () => {
  it('returns true for PAST_DUE', () => {
    expect(hasRevokedSubscriptionStatus('PAST_DUE')).toBe(true)
  })

  it('returns true for CANCELED', () => {
    expect(hasRevokedSubscriptionStatus('CANCELED')).toBe(true)
  })

  it('returns true for UNPAID', () => {
    expect(hasRevokedSubscriptionStatus('UNPAID')).toBe(true)
  })

  it('returns false for ACTIVE', () => {
    expect(hasRevokedSubscriptionStatus('ACTIVE')).toBe(false)
  })

  it('returns false for TRIALING', () => {
    expect(hasRevokedSubscriptionStatus('TRIALING')).toBe(false)
  })

  it('returns false for NONE', () => {
    expect(hasRevokedSubscriptionStatus('NONE')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(hasRevokedSubscriptionStatus('')).toBe(false)
  })
})

describe('canAccessPaidFeatures', () => {
  it('returns true when plan gates are not enforced', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(true)
    const user = makeUser({ plan: 'FREE' })
    expect(canAccessPaidFeatures(user)).toBe(true)
  })

  it('returns true for admin role', () => {
    expect(canAccessPaidFeatures(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('returns true for admin user by id', () => {
    mockedIsAdminUser.mockReturnValue(true)
    expect(canAccessPaidFeatures(makeUser({ plan: 'FREE' }))).toBe(true)
  })

  it('returns false for FREE plan', () => {
    expect(canAccessPaidFeatures(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns true for BUILDER plan', () => {
    expect(canAccessPaidFeatures(makeUser({ plan: 'BUILDER' }))).toBe(true)
  })

  it('returns true for TEAM plan', () => {
    expect(canAccessPaidFeatures(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('returns false for BUILDER with PAST_DUE status', () => {
    expect(
      canAccessPaidFeatures(makeUser({ plan: 'BUILDER', subscriptionStatus: 'PAST_DUE' }))
    ).toBe(false)
  })

  it('returns false for TEAM with CANCELED status', () => {
    expect(
      canAccessPaidFeatures(makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' }))
    ).toBe(false)
  })

  it('returns false for TEAM with UNPAID status', () => {
    expect(
      canAccessPaidFeatures(makeUser({ plan: 'TEAM', subscriptionStatus: 'UNPAID' }))
    ).toBe(false)
  })

  it('returns true for BUILDER with ACTIVE status', () => {
    expect(
      canAccessPaidFeatures(makeUser({ plan: 'BUILDER', subscriptionStatus: 'ACTIVE' }))
    ).toBe(true)
  })

  it('returns true for TEAM with TRIALING status', () => {
    expect(
      canAccessPaidFeatures(makeUser({ plan: 'TEAM', subscriptionStatus: 'TRIALING' }))
    ).toBe(true)
  })

  it('returns true for BUILDER with NONE status', () => {
    expect(
      canAccessPaidFeatures(makeUser({ plan: 'BUILDER', subscriptionStatus: 'NONE' }))
    ).toBe(true)
  })
})

describe('canSharePublicly', () => {
  it('returns true when plan gates are not enforced', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(true)
    expect(canSharePublicly(makeUser({ plan: 'FREE' }))).toBe(true)
  })

  it('returns true for admin role', () => {
    expect(canSharePublicly(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('returns true for admin user by id', () => {
    mockedIsAdminUser.mockReturnValue(true)
    expect(canSharePublicly(makeUser({ plan: 'FREE' }))).toBe(true)
  })

  it('returns false for FREE plan', () => {
    expect(canSharePublicly(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns false for BUILDER plan', () => {
    expect(canSharePublicly(makeUser({ plan: 'BUILDER' }))).toBe(false)
  })

  it('returns true for TEAM plan', () => {
    expect(canSharePublicly(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('returns false for TEAM with PAST_DUE status', () => {
    expect(
      canSharePublicly(makeUser({ plan: 'TEAM', subscriptionStatus: 'PAST_DUE' }))
    ).toBe(false)
  })

  it('returns false for TEAM with CANCELED status', () => {
    expect(
      canSharePublicly(makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' }))
    ).toBe(false)
  })

  it('returns false for TEAM with UNPAID status', () => {
    expect(
      canSharePublicly(makeUser({ plan: 'TEAM', subscriptionStatus: 'UNPAID' }))
    ).toBe(false)
  })

  it('returns true for TEAM with ACTIVE status', () => {
    expect(
      canSharePublicly(makeUser({ plan: 'TEAM', subscriptionStatus: 'ACTIVE' }))
    ).toBe(true)
  })

  it('returns true for TEAM with TRIALING status', () => {
    expect(
      canSharePublicly(makeUser({ plan: 'TEAM', subscriptionStatus: 'TRIALING' }))
    ).toBe(true)
  })

  it('returns true for TEAM with NONE status', () => {
    expect(
      canSharePublicly(makeUser({ plan: 'TEAM', subscriptionStatus: 'NONE' }))
    ).toBe(true)
  })
})

describe('canExportSummary', () => {
  it('delegates to canSharePublicly - false for BUILDER', () => {
    expect(canExportSummary(makeUser({ plan: 'BUILDER' }))).toBe(false)
  })

  it('delegates to canSharePublicly - true for TEAM', () => {
    expect(canExportSummary(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('delegates to canSharePublicly - false for FREE', () => {
    expect(canExportSummary(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns true for admin', () => {
    expect(canExportSummary(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('returns false for TEAM with revoked status', () => {
    expect(
      canExportSummary(makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' }))
    ).toBe(false)
  })
})

describe('canScanRepositories', () => {
  it('delegates to canSharePublicly - true for TEAM', () => {
    expect(canScanRepositories(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('delegates to canSharePublicly - false for BUILDER', () => {
    expect(canScanRepositories(makeUser({ plan: 'BUILDER' }))).toBe(false)
  })

  it('delegates to canSharePublicly - false for FREE', () => {
    expect(canScanRepositories(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns true for admin', () => {
    expect(canScanRepositories(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('returns false for TEAM with revoked status', () => {
    expect(
      canScanRepositories(makeUser({ plan: 'TEAM', subscriptionStatus: 'PAST_DUE' }))
    ).toBe(false)
  })
})

describe('canAccessProductWatch', () => {
  it('delegates to canAccessPaidFeatures - true for BUILDER', () => {
    expect(canAccessProductWatch(makeUser({ plan: 'BUILDER' }))).toBe(true)
  })

  it('delegates to canAccessPaidFeatures - true for TEAM', () => {
    expect(canAccessProductWatch(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('delegates to canAccessPaidFeatures - false for FREE', () => {
    expect(canAccessProductWatch(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns true for admin', () => {
    expect(canAccessProductWatch(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('returns false for BUILDER with revoked status', () => {
    expect(
      canAccessProductWatch(makeUser({ plan: 'BUILDER', subscriptionStatus: 'UNPAID' }))
    ).toBe(false)
  })
})

describe('canUseApiKeys', () => {
  it('delegates to canAccessPaidFeatures - true for BUILDER', () => {
    expect(canUseApiKeys(makeUser({ plan: 'BUILDER' }))).toBe(true)
  })

  it('delegates to canAccessPaidFeatures - true for TEAM', () => {
    expect(canUseApiKeys(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('delegates to canAccessPaidFeatures - false for FREE', () => {
    expect(canUseApiKeys(makeUser({ plan: 'FREE' }))).toBe(false)
  })
})

describe('canAccessMonitoring', () => {
  it('always returns true', () => {
    expect(canAccessMonitoring()).toBe(true)
  })
})

describe('canAccessCompare', () => {
  it('delegates to canAccessPaidFeatures - true for BUILDER', () => {
    expect(canAccessCompare(makeUser({ plan: 'BUILDER' }))).toBe(true)
  })

  it('delegates to canAccessPaidFeatures - true for TEAM', () => {
    expect(canAccessCompare(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('delegates to canAccessPaidFeatures - false for FREE', () => {
    expect(canAccessCompare(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns true for admin', () => {
    expect(canAccessCompare(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })
})

describe('getReportTierForUser', () => {
  it('returns free for null user', () => {
    expect(getReportTierForUser(null)).toBe('free')
  })

  it('returns free for undefined user', () => {
    expect(getReportTierForUser(undefined)).toBe('free')
  })

  it('returns paid for admin user', () => {
    expect(getReportTierForUser(makeUser({ role: 'admin', plan: 'FREE' }))).toBe('paid')
  })

  it('returns paid for admin user by id', () => {
    mockedIsAdminUser.mockReturnValue(true)
    expect(getReportTierForUser(makeUser({ plan: 'FREE' }))).toBe('paid')
  })

  it('returns free for FREE plan', () => {
    expect(getReportTierForUser(makeUser({ plan: 'FREE' }))).toBe('free')
  })

  it('returns paid for BUILDER plan', () => {
    expect(getReportTierForUser(makeUser({ plan: 'BUILDER' }))).toBe('paid')
  })

  it('returns paid for TEAM plan', () => {
    expect(getReportTierForUser(makeUser({ plan: 'TEAM' }))).toBe('paid')
  })

  it('returns free for TEAM with PAST_DUE', () => {
    expect(
      getReportTierForUser(makeUser({ plan: 'TEAM', subscriptionStatus: 'PAST_DUE' }))
    ).toBe('free')
  })

  it('returns free for TEAM with CANCELED', () => {
    expect(
      getReportTierForUser(makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' }))
    ).toBe('free')
  })

  it('returns free for TEAM with UNPAID', () => {
    expect(
      getReportTierForUser(makeUser({ plan: 'TEAM', subscriptionStatus: 'UNPAID' }))
    ).toBe('free')
  })

  it('returns paid for TEAM with ACTIVE', () => {
    expect(
      getReportTierForUser(makeUser({ plan: 'TEAM', subscriptionStatus: 'ACTIVE' }))
    ).toBe('paid')
  })

  it('returns paid for BUILDER with TRIALING', () => {
    expect(
      getReportTierForUser(makeUser({ plan: 'BUILDER', subscriptionStatus: 'TRIALING' }))
    ).toBe('paid')
  })

  it('returns paid when plan gates are not enforced', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(true)
    expect(getReportTierForUser(makeUser({ plan: 'FREE' }))).toBe('paid')
  })
})

describe('getEntitlements', () => {
  it('returns correct entitlements for FREE user', () => {
    const entitlements = getEntitlements(makeUser({ plan: 'FREE' }))
    expect(entitlements).toEqual({
      reportTier: 'free',
      canSharePublicly: false,
      canExportSummary: false,
      canAccessPaidFeatures: false,
      canMonitor: true,
      canWatchProduct: false,
      canUseMcp: false,
      canScanRepositories: false,
    })
  })

  it('returns correct entitlements for BUILDER user', () => {
    const entitlements = getEntitlements(makeUser({ plan: 'BUILDER' }))
    expect(entitlements).toEqual({
      reportTier: 'paid',
      canSharePublicly: false,
      canExportSummary: false,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: true,
      canUseMcp: true,
      canScanRepositories: false,
    })
  })

  it('returns correct entitlements for TEAM user', () => {
    const entitlements = getEntitlements(makeUser({ plan: 'TEAM' }))
    expect(entitlements).toEqual({
      reportTier: 'paid',
      canSharePublicly: true,
      canExportSummary: true,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: true,
      canUseMcp: true,
      canScanRepositories: true,
    })
  })

  it('returns correct entitlements for admin user', () => {
    const entitlements = getEntitlements(makeUser({ role: 'admin', plan: 'FREE' }))
    expect(entitlements).toEqual({
      reportTier: 'paid',
      canSharePublicly: true,
      canExportSummary: true,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: true,
      canUseMcp: true,
      canScanRepositories: true,
    })
  })

  it('returns revoked entitlements for TEAM with CANCELED status', () => {
    const entitlements = getEntitlements(
      makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' })
    )
    expect(entitlements).toEqual({
      reportTier: 'free',
      canSharePublicly: false,
      canExportSummary: false,
      canAccessPaidFeatures: false,
      canMonitor: true,
      canWatchProduct: false,
      canUseMcp: false,
      canScanRepositories: false,
    })
  })

  it('returns full entitlements when plan gates are not enforced', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(true)
    const entitlements = getEntitlements(makeUser({ plan: 'FREE' }))
    expect(entitlements).toEqual({
      reportTier: 'paid',
      canSharePublicly: true,
      canExportSummary: true,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: true,
      canUseMcp: true,
      canScanRepositories: true,
    })
  })
})

describe('resolveReportTierForAudit', () => {
  it('returns free when audit has no userId', async () => {
    const tier = await resolveReportTierForAudit({ userId: null, isPublic: false })
    expect(tier).toBe('free')
    expect(mockedFindUnique).not.toHaveBeenCalled()
  })

  it('returns free when owner is not found', async () => {
    mockedFindUnique.mockResolvedValue(null)
    const tier = await resolveReportTierForAudit({ userId: 'user-1', isPublic: false })
    expect(tier).toBe('free')
    expect(mockedFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, plan: true, role: true, subscriptionStatus: true },
    })
  })

  it('returns free when owner is on FREE plan', async () => {
    mockedFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'FREE',
      role: 'user',
      subscriptionStatus: 'NONE',
    })
    const tier = await resolveReportTierForAudit({ userId: 'user-1', isPublic: true })
    expect(tier).toBe('free')
  })

  it('returns paid when owner is on TEAM plan', async () => {
    mockedFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'TEAM',
      role: 'user',
      subscriptionStatus: 'ACTIVE',
    })
    const tier = await resolveReportTierForAudit({ userId: 'user-1', isPublic: true })
    expect(tier).toBe('paid')
  })

  it('returns paid when owner is admin', async () => {
    mockedFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'FREE',
      role: 'admin',
      subscriptionStatus: 'NONE',
    })
    const tier = await resolveReportTierForAudit({ userId: 'user-1', isPublic: false })
    expect(tier).toBe('paid')
  })

  it('returns free when owner TEAM has revoked subscription', async () => {
    mockedFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'TEAM',
      role: 'user',
      subscriptionStatus: 'CANCELED',
    })
    const tier = await resolveReportTierForAudit({ userId: 'user-1', isPublic: true })
    expect(tier).toBe('free')
  })
})
