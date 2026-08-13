import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { User } from '@prisma/client'

vi.mock('@/lib/auth/permissions', () => ({
  getEffectiveScanLimit: vi.fn(),
  hasUnlimitedScans: vi.fn(),
  isAdminUser: vi.fn(),
  isDevUnlimitedScans: vi.fn(),
}))

vi.mock('@/lib/audit/check-limit-utils', () => ({
  isUnlimitedScanLimit: vi.fn(),
  isAtCheckLimit: vi.fn(),
  limitErrorCodeForPlan: vi.fn(),
}))

import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isDevUnlimitedScans,
} from '@/lib/auth/permissions'
import {
  isUnlimitedScanLimit,
  isAtCheckLimit,
  limitErrorCodeForPlan,
} from '@/lib/audit/check-limit-utils'
import { wouldBlockNewCheck } from '@/lib/audit/check-limit'

const mockedGetEffectiveScanLimit = vi.mocked(getEffectiveScanLimit)
const mockedHasUnlimitedScans = vi.mocked(hasUnlimitedScans)
const mockedIsAdminUser = vi.mocked(isAdminUser)
const mockedIsDevUnlimitedScans = vi.mocked(isDevUnlimitedScans)
const mockedIsUnlimitedScanLimit = vi.mocked(isUnlimitedScanLimit)
const mockedIsAtCheckLimit = vi.mocked(isAtCheckLimit)
const mockedLimitErrorCodeForPlan = vi.mocked(limitErrorCodeForPlan)

type UserPick = Pick<User, 'id' | 'plan' | 'role' | 'auditsUsed' | 'auditsLimit'>

function makeUser(overrides: Partial<UserPick> = {}): UserPick {
  return {
    id: 'user-1',
    plan: 'FREE',
    role: 'user',
    auditsUsed: 0,
    auditsLimit: 3,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('wouldBlockNewCheck', () => {
  it('allows when dev unlimited scans', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(true)

    const result = wouldBlockNewCheck(makeUser(), 0)
    expect(result).toEqual({ allowed: true })
  })

  it('allows when user has unlimited scans', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(true)

    const result = wouldBlockNewCheck(makeUser(), 0)
    expect(result).toEqual({ allowed: true })
  })

  it('allows when user is admin', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(true)

    const result = wouldBlockNewCheck(makeUser(), 0)
    expect(result).toEqual({ allowed: true })
  })

  it('allows when limit is unlimited', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(-1)
    mockedIsUnlimitedScanLimit.mockReturnValue(true)

    const result = wouldBlockNewCheck(makeUser(), 0)
    expect(result).toEqual({ allowed: true })
  })

  it('blocks when at check limit for FREE plan', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(3)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(true)
    mockedLimitErrorCodeForPlan.mockReturnValue('UPGRADE_REQUIRED')

    const result = wouldBlockNewCheck(makeUser({ plan: 'FREE', auditsUsed: 3 }), 0)

    expect(result).toEqual({
      allowed: false,
      error: 'New URL check limit reached. Upgrade to continue.',
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
    })
  })

  it('blocks when at check limit for BUILDER plan', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(25)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(true)
    mockedLimitErrorCodeForPlan.mockReturnValue('TOKEN_LIMIT')

    const result = wouldBlockNewCheck(makeUser({ plan: 'BUILDER', auditsUsed: 25 }), 0)

    expect(result).toEqual({
      allowed: false,
      error: 'New URL check limit reached. Buy credits or upgrade your plan to continue.',
      code: 'TOKEN_LIMIT',
      action: 'buy_credits',
    })
  })

  it('blocks when at check limit for TEAM plan', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(100)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(true)
    mockedLimitErrorCodeForPlan.mockReturnValue('TOKEN_LIMIT')

    const result = wouldBlockNewCheck(makeUser({ plan: 'TEAM', auditsUsed: 100 }), 0)

    expect(result).toEqual({
      allowed: false,
      error: 'New URL check limit reached. Buy credits or upgrade your plan to continue.',
      code: 'TOKEN_LIMIT',
      action: 'buy_credits',
    })
  })

  it('allows when not at check limit', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(10)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(false)

    const result = wouldBlockNewCheck(makeUser({ auditsUsed: 3, auditsLimit: 10 }), 2)

    expect(result).toEqual({ allowed: true })
  })

  it('allows when pending pushes to limit but not over', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(10)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(false)

    const result = wouldBlockNewCheck(makeUser({ auditsUsed: 5, auditsLimit: 10 }), 4)

    expect(result).toEqual({ allowed: true })
  })

  it('uses user plan for error code', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(3)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(true)

    wouldBlockNewCheck(makeUser({ plan: 'FREE' }), 0)
    expect(mockedLimitErrorCodeForPlan).toHaveBeenCalledWith('FREE')

    wouldBlockNewCheck(makeUser({ plan: 'BUILDER' }), 0)
    expect(mockedLimitErrorCodeForPlan).toHaveBeenCalledWith('BUILDER')

    wouldBlockNewCheck(makeUser({ plan: 'TEAM' }), 0)
    expect(mockedLimitErrorCodeForPlan).toHaveBeenCalledWith('TEAM')
  })

  it('checks isAtCheckLimit with used, pending, and limit', () => {
    mockedIsDevUnlimitedScans.mockReturnValue(false)
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(10)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(false)

    wouldBlockNewCheck(makeUser({ auditsUsed: 5, auditsLimit: 10 }), 3)

    expect(mockedIsAtCheckLimit).toHaveBeenCalledWith(5, 3, 10)
  })
})