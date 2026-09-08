import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { User } from '@prisma/client'

vi.mock('@/lib/env', () => {
  const env = {
    NODE_ENV: 'test',
    ADMIN_USER_IDS: [] as string[],
  }
  return {
    getEnv: () => env,
  }
})

import {
  canAccessPaidFeatures,
  canExportSummary,
  canScanRepositories,
  canAccessProductWatch,
  canUseApiKeys,
  canAccessMonitoring,
  hasRevokedSubscriptionStatus,
  getEntitlements,
} from '@/lib/auth/entitlements'

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

let originalAdminIds: string | undefined

beforeEach(() => {
  originalAdminIds = process.env.ADMIN_USER_IDS
  process.env.ADMIN_USER_IDS = ''
  vi.clearAllMocks()
})

afterEach(() => {
  if (originalAdminIds === undefined) {
    delete process.env.ADMIN_USER_IDS
  } else {
    process.env.ADMIN_USER_IDS = originalAdminIds
  }
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
  it('returns true for admin role', () => {
    expect(canAccessPaidFeatures(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
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

describe('canExportSummary', () => {
  it('returns true for BUILDER plan', () => {
    expect(canExportSummary(makeUser({ plan: 'BUILDER' }))).toBe(true)
  })

  it('returns true for TEAM plan', () => {
    expect(canExportSummary(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('returns true for FREE plan', () => {
    expect(canExportSummary(makeUser({ plan: 'FREE' }))).toBe(true)
  })

  it('returns true for admin', () => {
    expect(canExportSummary(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('keeps export available for TEAM with revoked status', () => {
    expect(
      canExportSummary(makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' }))
    ).toBe(true)
  })
})

describe('canScanRepositories', () => {
  it('returns true for TEAM plan', () => {
    expect(canScanRepositories(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('returns false for BUILDER plan', () => {
    expect(canScanRepositories(makeUser({ plan: 'BUILDER' }))).toBe(false)
  })

  it('returns false for FREE plan', () => {
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
  it('returns false for BUILDER plan', () => {
    expect(canAccessProductWatch(makeUser({ plan: 'BUILDER' }))).toBe(false)
  })

  it('returns true for TEAM plan', () => {
    expect(canAccessProductWatch(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('returns false for FREE plan', () => {
    expect(canAccessProductWatch(makeUser({ plan: 'FREE' }))).toBe(false)
  })

  it('returns true for admin', () => {
    expect(canAccessProductWatch(makeUser({ role: 'admin', plan: 'FREE' }))).toBe(true)
  })

  it('revokes Watch for Studio with revoked status', () => {
    expect(
      canAccessProductWatch(makeUser({ plan: 'TEAM', subscriptionStatus: 'UNPAID' }))
    ).toBe(false)
  })
})

describe('canUseApiKeys', () => {
  it('returns true for BUILDER plan', () => {
    expect(canUseApiKeys(makeUser({ plan: 'BUILDER' }))).toBe(true)
  })

  it('returns true for TEAM plan', () => {
    expect(canUseApiKeys(makeUser({ plan: 'TEAM' }))).toBe(true)
  })

  it('returns false for FREE plan', () => {
    expect(canUseApiKeys(makeUser({ plan: 'FREE' }))).toBe(false)
  })
})

describe('canAccessMonitoring', () => {
  it('always returns true', () => {
    expect(canAccessMonitoring()).toBe(true)
  })
})

describe('getEntitlements', () => {
  it('returns correct entitlements for FREE user', () => {
    const entitlements = getEntitlements(makeUser({ plan: 'FREE' }))
    expect(entitlements).toEqual({
      canExportSummary: true,
      canAccessPaidFeatures: false,
      canMonitor: true,
      canWatchProduct: false,
      canUseMcp: false,
      canAccessBasicMcp: true,
      canScanRepositories: false,
    })
  })

  it('returns correct entitlements for BUILDER user', () => {
    const entitlements = getEntitlements(makeUser({ plan: 'BUILDER' }))
    expect(entitlements).toEqual({
      canExportSummary: true,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: false,
      canUseMcp: true,
      canAccessBasicMcp: true,
      canScanRepositories: false,
    })
  })

  it('returns correct entitlements for TEAM user', () => {
    const entitlements = getEntitlements(makeUser({ plan: 'TEAM' }))
    expect(entitlements).toEqual({
      canExportSummary: true,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: true,
      canUseMcp: true,
      canAccessBasicMcp: true,
      canScanRepositories: true,
    })
  })

  it('returns correct entitlements for admin user', () => {
    const entitlements = getEntitlements(makeUser({ role: 'admin', plan: 'FREE' }))
    expect(entitlements).toEqual({
      canExportSummary: true,
      canAccessPaidFeatures: true,
      canMonitor: true,
      canWatchProduct: true,
      canUseMcp: true,
      canAccessBasicMcp: true,
      canScanRepositories: true,
    })
  })

  it('revokes power tools but preserves web capabilities after cancellation', () => {
    const entitlements = getEntitlements(
      makeUser({ plan: 'TEAM', subscriptionStatus: 'CANCELED' })
    )
    expect(entitlements).toEqual({
      canExportSummary: true,
      canAccessPaidFeatures: false,
      canMonitor: true,
      canWatchProduct: false,
      canUseMcp: false,
      canAccessBasicMcp: false,
      canScanRepositories: false,
    })
  })
})
