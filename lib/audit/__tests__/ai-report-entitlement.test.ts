import { describe, expect, it, vi, beforeEach } from 'vitest'

const dbMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn<() => Promise<unknown>>(),
  auditCount: vi.fn<() => Promise<number>>(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: dbMocks.userFindUnique },
    audit: { count: dbMocks.auditCount },
  },
}))

vi.mock('@/lib/auth/permissions', () => ({
  getEffectiveScanLimit: vi.fn(),
  hasUnlimitedScans: vi.fn(),
  isAdminUser: vi.fn(),
  isUnlimitedScanLimit: vi.fn(),
}))

vi.mock('@/lib/auth/entitlements', () => ({
  hasRevokedSubscriptionStatus: vi.fn(),
}))

vi.mock('@/lib/audit/check-limit', () => ({
  isAtCheckLimit: vi.fn(),
}))

vi.mock('@/lib/billing/credits', () => ({
  getPurchasedCreditsRemaining: vi.fn(),
  getTotalAvailableCredits: vi.fn(),
}))

import {
  getEffectiveScanLimit,
  hasUnlimitedScans,
  isAdminUser,
  isUnlimitedScanLimit,
} from '@/lib/auth/permissions'
import { hasRevokedSubscriptionStatus } from '@/lib/auth/entitlements'
import { isAtCheckLimit } from '@/lib/audit/check-limit'
import { getPurchasedCreditsRemaining, getTotalAvailableCredits } from '@/lib/billing/credits'
import {
  resolveIncludeAiForNewAudit,
  remainingAiReportCredits,
} from '@/lib/audit/ai-report-entitlement'

const mockedUserFindUnique = dbMocks.userFindUnique
const mockedAuditCount = dbMocks.auditCount
const mockedGetEffectiveScanLimit = vi.mocked(getEffectiveScanLimit)
const mockedHasUnlimitedScans = vi.mocked(hasUnlimitedScans)
const mockedIsAdminUser = vi.mocked(isAdminUser)
const mockedIsUnlimitedScanLimit = vi.mocked(isUnlimitedScanLimit)
const mockedHasRevokedSubscriptionStatus = vi.mocked(hasRevokedSubscriptionStatus)
const mockedIsAtCheckLimit = vi.mocked(isAtCheckLimit)
const mockedGetPurchasedCreditsRemaining = vi.mocked(getPurchasedCreditsRemaining)
const mockedGetTotalAvailableCredits = vi.mocked(getTotalAvailableCredits)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('resolveIncludeAiForNewAudit', () => {
  it('returns false when userId is null', async () => {
    expect(await resolveIncludeAiForNewAudit(null)).toBe(false)
  })

  it('returns false when user not found', async () => {
    mockedUserFindUnique.mockResolvedValue(null)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(false)
    expect(mockedUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, plan: true, role: true, auditsUsed: true, auditsLimit: true, subscriptionStatus: true },
    })
  })

  it('returns true for unlimited scans users', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'FREE',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 3,
      subscriptionStatus: 'NONE',
    })
    mockedHasUnlimitedScans.mockReturnValue(true)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(true)
    expect(mockedHasUnlimitedScans).toHaveBeenCalled()
  })

  it('returns true for admin users', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'FREE',
      role: 'admin',
      auditsUsed: 0,
      auditsLimit: 3,
      subscriptionStatus: 'NONE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(true)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(true)
    expect(mockedIsAdminUser).toHaveBeenCalledWith(expect.objectContaining({ id: 'user-1', plan: 'FREE', role: 'admin', auditsUsed: 0, auditsLimit: 3, subscriptionStatus: 'NONE' }))
  })

  it('returns true when at check limit is false (limit is positive)', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 5,
      auditsLimit: 25,
      subscriptionStatus: 'ACTIVE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(25)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedHasRevokedSubscriptionStatus.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(false)
    mockedAuditCount.mockResolvedValue(0)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(true)
    expect(mockedIsAtCheckLimit).toHaveBeenCalledWith(5, 0, 25)
  })

  it('returns false when at check limit is true and not revoked (tiered plan)', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 25,
      auditsLimit: 25,
      subscriptionStatus: 'ACTIVE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(25)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedHasRevokedSubscriptionStatus.mockReturnValue(false)
    mockedIsAtCheckLimit.mockReturnValue(true)
    mockedAuditCount.mockResolvedValue(0)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(false)
    expect(mockedIsAtCheckLimit).toHaveBeenCalledWith(25, 0, 25)
  })

  it('returns true when limit is unlimited and not revoked', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 5,
      auditsLimit: 25,
      subscriptionStatus: 'ACTIVE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(-1)
    mockedIsUnlimitedScanLimit.mockReturnValue(true)
    mockedHasRevokedSubscriptionStatus.mockReturnValue(false)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(true)
    expect(mockedIsUnlimitedScanLimit).toHaveBeenCalledWith(-1)
  })

  it('returns false when revoked subscription and at check limit', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 25,
      auditsLimit: 25,
      subscriptionStatus: 'PAST_DUE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(25)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedHasRevokedSubscriptionStatus.mockReturnValue(true)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(false)
    expect(mockedHasRevokedSubscriptionStatus).toHaveBeenCalledWith('PAST_DUE')
  })

  it('returns true when revoked subscription but purchased credits > pending', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 25,
      auditsLimit: 25,
      subscriptionStatus: 'PAST_DUE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(25)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedHasRevokedSubscriptionStatus.mockReturnValue(true)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(5)
    mockedAuditCount.mockResolvedValue(2)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(true)
    expect(mockedGetPurchasedCreditsRemaining).toHaveBeenCalledWith('user-1')
    expect(mockedAuditCount).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        includeAi: true,
        aiReviewAt: null,
        status: { notIn: ['COMPLETED', 'FAILED'] },
      },
    })
  })

  it('returns false when revoked subscription and purchased credits <= pending', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      plan: 'BUILDER',
      role: 'user',
      auditsUsed: 25,
      auditsLimit: 25,
      subscriptionStatus: 'PAST_DUE',
    })
    mockedHasUnlimitedScans.mockReturnValue(false)
    mockedIsAdminUser.mockReturnValue(false)
    mockedGetEffectiveScanLimit.mockReturnValue(25)
    mockedIsUnlimitedScanLimit.mockReturnValue(false)
    mockedHasRevokedSubscriptionStatus.mockReturnValue(true)
    mockedGetPurchasedCreditsRemaining.mockResolvedValue(1)
    mockedAuditCount.mockResolvedValue(2)

    expect(await resolveIncludeAiForNewAudit('user-1')).toBe(false)
  })
})

describe('remainingAiReportCredits', () => {
  it('returns total available credits for user', async () => {
    const user = {
      id: 'user-1',
      auditsUsed: 5,
      auditsLimit: 25,
      role: 'user',
    }

    mockedGetTotalAvailableCredits.mockResolvedValue(10)

    const result = await remainingAiReportCredits(user)

    expect(result).toBe(10)
    expect(mockedGetTotalAvailableCredits).toHaveBeenCalledWith(user)
  })
})
