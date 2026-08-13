import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import type { User } from '@prisma/client'

vi.mock('@/lib/env', () => {
  const env = {
    NODE_ENV: 'test',
    ADMIN_USER_IDS: ['admin-1', 'admin-2'] as string[],
  }
  return {
    getEnv: () => env,
  }
})

vi.mock('@/lib/billing/credits', () => ({
  getPurchasedCreditsRemaining: vi.fn(),
}))

import { prisma } from '@/lib/db'
import {
  isDevUnlimitedScans,
  isAdminUser,
  hasUnlimitedScans,
  getEffectiveScanLimit,
  isUnlimitedScanLimit,
  getPendingCheckCount,
  getCheckUsage,
  UNLIMITED_SCAN_LIMIT,
} from '@/lib/auth/permissions'
import { getPurchasedCreditsRemaining } from '@/lib/billing/credits'

const mockedGetPurchasedCreditsRemaining = vi.mocked(getPurchasedCreditsRemaining)

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: {
      count: vi.fn(),
    },
  },
}))

const mockedAuditCount = vi.mocked(prisma.audit.count)

type UserPick = Pick<User, 'id' | 'role' | 'plan' | 'auditsUsed' | 'auditsLimit' | 'subscriptionStatus'>

function makeUser(overrides: Partial<UserPick> = {}): UserPick {
  return {
    id: 'user-1',
    role: 'user',
    plan: 'FREE',
    auditsUsed: 0,
    auditsLimit: 3,
    subscriptionStatus: 'NONE',
    ...overrides,
  }
}

let originalNodeEnv: string | undefined
let originalDevSimulateBilling: string | undefined

function setEnv(name: string, value?: string): void {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

beforeEach(() => {
  originalNodeEnv = process.env.NODE_ENV
  originalDevSimulateBilling = process.env.DEV_SIMULATE_BILLING
  vi.clearAllMocks()
  mockedGetPurchasedCreditsRemaining.mockResolvedValue(0)
  mockedAuditCount.mockResolvedValue(0)
})

afterEach(() => {
  if (originalNodeEnv === undefined) {
    setEnv('NODE_ENV')
  } else {
    setEnv('NODE_ENV', originalNodeEnv)
  }
  if (originalDevSimulateBilling === undefined) {
    delete process.env.DEV_SIMULATE_BILLING
  } else {
    process.env.DEV_SIMULATE_BILLING = originalDevSimulateBilling
  }
})

describe('UNLIMITED_SCAN_LIMIT', () => {
  it('is -1', () => {
    expect(UNLIMITED_SCAN_LIMIT).toBe(-1)
  })
})

describe('isDevUnlimitedScans', () => {
  it('returns true in development without DEV_SIMULATE_BILLING', () => {
    setEnv('NODE_ENV', 'development')
    process.env.DEV_SIMULATE_BILLING = 'false'
    expect(isDevUnlimitedScans()).toBe(true)
  })

  it('returns false when DEV_SIMULATE_BILLING is true', () => {
    setEnv('NODE_ENV', 'development')
    process.env.DEV_SIMULATE_BILLING = 'true'
    expect(isDevUnlimitedScans()).toBe(false)
  })

  it('returns false in production', () => {
    setEnv('NODE_ENV', 'production')
    expect(isDevUnlimitedScans()).toBe(false)
  })

  it('returns false in test', () => {
    setEnv('NODE_ENV', 'test')
    expect(isDevUnlimitedScans()).toBe(false)
  })
})

describe('isAdminUser', () => {
  it('returns true for admin role', () => {
    expect(isAdminUser(makeUser({ role: 'admin' }))).toBe(true)
  })

  it('returns true for user id in ADMIN_USER_IDS', () => {
    expect(isAdminUser(makeUser({ id: 'admin-1', role: 'user' }))).toBe(true)
    expect(isAdminUser(makeUser({ id: 'admin-2', role: 'user' }))).toBe(true)
  })

  it('returns false for regular user', () => {
    expect(isAdminUser(makeUser({ role: 'user' }))).toBe(false)
  })

  it('returns false for user id not in ADMIN_USER_IDS', () => {
    expect(isAdminUser(makeUser({ id: 'user-1', role: 'user' }))).toBe(false)
  })
})

describe('hasUnlimitedScans', () => {
  it('returns true in dev unlimited mode', () => {
    setEnv('NODE_ENV', 'development')
    process.env.DEV_SIMULATE_BILLING = 'false'
    expect(hasUnlimitedScans(makeUser({ role: 'user' }))).toBe(true)
  })

  it('returns true for admin role', () => {
    setEnv('NODE_ENV', 'production')
    expect(hasUnlimitedScans(makeUser({ role: 'admin' }))).toBe(true)
  })

  it('returns false for regular user in production', () => {
    setEnv('NODE_ENV', 'production')
    expect(hasUnlimitedScans(makeUser({ role: 'user' }))).toBe(false)
  })

  it('returns false when DEV_SIMULATE_BILLING is true', () => {
    setEnv('NODE_ENV', 'development')
    process.env.DEV_SIMULATE_BILLING = 'true'
    expect(hasUnlimitedScans(makeUser({ role: 'user' }))).toBe(false)
  })
})

describe('getEffectiveScanLimit', () => {
  it('returns UNLIMITED_SCAN_LIMIT for unlimited users', () => {
    setEnv('NODE_ENV', 'development')
    process.env.DEV_SIMULATE_BILLING = 'false'
    expect(getEffectiveScanLimit(makeUser({ role: 'user' }))).toBe(UNLIMITED_SCAN_LIMIT)
  })

  it('returns UNLIMITED_SCAN_LIMIT for admin', () => {
    setEnv('NODE_ENV', 'production')
    expect(getEffectiveScanLimit(makeUser({ role: 'admin' }))).toBe(UNLIMITED_SCAN_LIMIT)
  })

  it('returns user.auditsLimit for regular user', () => {
    setEnv('NODE_ENV', 'production')
    expect(getEffectiveScanLimit(makeUser({ auditsLimit: 10 }))).toBe(10)
    expect(getEffectiveScanLimit(makeUser({ auditsLimit: 25 }))).toBe(25)
  })

  it('returns 0 when auditsLimit is 0', () => {
    setEnv('NODE_ENV', 'production')
    expect(getEffectiveScanLimit(makeUser({ auditsLimit: 0 }))).toBe(0)
  })
})

describe('isUnlimitedScanLimit', () => {
  it('returns true for UNLIMITED_SCAN_LIMIT', () => {
    expect(isUnlimitedScanLimit(UNLIMITED_SCAN_LIMIT)).toBe(true)
  })

  it('returns false for 0', () => {
    expect(isUnlimitedScanLimit(0)).toBe(false)
  })

  it('returns false for positive numbers', () => {
    expect(isUnlimitedScanLimit(1)).toBe(false)
    expect(isUnlimitedScanLimit(10)).toBe(false)
    expect(isUnlimitedScanLimit(100)).toBe(false)
  })

  it('returns false for other negative values', () => {
    expect(isUnlimitedScanLimit(-2)).toBe(false)
  })
})

describe('getPendingCheckCount', () => {
  it('counts audits not in COMPLETED or FAILED', async () => {
    mockedAuditCount.mockResolvedValue(5)
    const count = await getPendingCheckCount('user-1')
    expect(count).toBe(5)
    expect(mockedAuditCount).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        status: { notIn: ['COMPLETED', 'FAILED'] },
      },
    })
  })

  it('returns 0 when no pending audits', async () => {
    mockedAuditCount.mockResolvedValue(0)
    const count = await getPendingCheckCount('user-1')
    expect(count).toBe(0)
  })
})

describe('getCheckUsage', () => {
  it('returns unlimited usage in dev mode', async () => {
    setEnv('NODE_ENV', 'development')
    process.env.DEV_SIMULATE_BILLING = 'false'
    mockedAuditCount.mockResolvedValue(3)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', auditsUsed: 2, auditsLimit: 3 }))

    expect(usage).toEqual({
      used: 2,
      pending: 3,
      limit: null,
      isUnlimited: true,
      purchasedCredits: 0,
      totalAvailable: null,
    })
    // In dev unlimited mode, getPurchasedCreditsRemaining is not called
    expect(mockedGetPurchasedCreditsRemaining).not.toHaveBeenCalled()
  })

  it('returns unlimited usage for admin', async () => {
    setEnv('NODE_ENV', 'production')
    mockedAuditCount.mockResolvedValue(3)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', role: 'admin', auditsUsed: 2, auditsLimit: 3 }))

    expect(usage.isUnlimited).toBe(true)
    expect(usage.limit).toBeNull()
    expect(usage.totalAvailable).toBeNull()
  })

  it('returns limited usage for regular user', async () => {
    setEnv('NODE_ENV', 'production')
    mockedAuditCount.mockResolvedValue(1)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(5)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', auditsUsed: 2, auditsLimit: 10 }))

    expect(usage).toEqual({
      used: 2,
      pending: 1,
      limit: 10,
      isUnlimited: false,
      purchasedCredits: 5,
      totalAvailable: 13, // (10 - 2) + 5
    })
  })

  it('returns totalAvailable as planRemaining + purchasedCredits when planRemaining > 0', async () => {
    setEnv('NODE_ENV', 'production')
    mockedAuditCount.mockResolvedValue(0)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(3)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', auditsUsed: 2, auditsLimit: 10 }))

    expect(usage.totalAvailable).toBe(11) // (10 - 2) + 3
  })

  it('returns totalAvailable as purchasedCredits when planRemaining is 0', async () => {
    setEnv('NODE_ENV', 'production')
    mockedAuditCount.mockResolvedValue(0)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(3)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', auditsUsed: 10, auditsLimit: 10 }))

    expect(usage.totalAvailable).toBe(3) // max(0, 10 - 10) + 3
  })

  it('returns totalAvailable as purchasedCredits when planRemaining is negative', async () => {
    setEnv('NODE_ENV', 'production')
    mockedAuditCount.mockResolvedValue(0)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(3)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', auditsUsed: 12, auditsLimit: 10 }))

    expect(usage.totalAvailable).toBe(3) // max(0, 10 - 12) + 3
  })

  it('uses actual pending count', async () => {
    setEnv('NODE_ENV', 'production')
    mockedAuditCount.mockResolvedValue(7)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(2)

    const usage = await getCheckUsage(makeUser({ id: 'user-1', auditsUsed: 3, auditsLimit: 10 }))

    expect(usage.pending).toBe(7)
    expect(usage.totalAvailable).toBe(9) // (10 - 3) + 2
  })
})
