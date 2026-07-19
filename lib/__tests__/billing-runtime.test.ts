import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Shared prisma mock functions - hoisted so vi.mock factory can reference them
const { mockAggregate, mockFindFirst, mockUpdate, mockAuditCount, mockAuditFindUnique, mockUserFindUnique, mockUserUpdate, mockAuditUpdate } = vi.hoisted(() => ({
  mockAggregate: vi.fn(),
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockAuditCount: vi.fn(),
  mockAuditFindUnique: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserUpdate: vi.fn(),
  mockAuditUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    creditPurchase: {
      aggregate: mockAggregate,
      findFirst: mockFindFirst,
      update: mockUpdate,
    },
    audit: {
      count: mockAuditCount,
      findUnique: mockAuditFindUnique,
      update: mockAuditUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
      update: mockUserUpdate,
    },
    $transaction: vi.fn((cb: (tx: unknown) => unknown) => cb({
      audit: { findUnique: mockAuditFindUnique, update: mockAuditUpdate },
      user: { findUnique: mockUserFindUnique, update: mockUserUpdate },
      creditPurchase: { findFirst: mockFindFirst, update: mockUpdate },
    })),
  },
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

import { wouldBlockNewCheckWithCredits, consumePurchasedCredit } from '@/lib/billing/credits'
import { checkAnonymousAuditAllowed, incrementUsageOnCompleteForAudit } from '@/lib/audit/usage'
import { getCheckUsage } from '@/lib/auth/permissions'
import { cookies } from 'next/headers'

beforeEach(() => {
  vi.clearAllMocks()
})

afterEach(() => {
  vi.unstubAllEnvs()
  delete process.env.DEV_SIMULATE_BILLING
})

// ── wouldBlockNewCheckWithCredits ────────────────────────────────

describe('wouldBlockNewCheckWithCredits', () => {
  it('allows when plan has remaining capacity', async () => {
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(
      { id: 'u1', plan: 'FREE', role: 'user', auditsUsed: 0, auditsLimit: 3 },
      0,
    )
    expect(result).toEqual({ allowed: true })
  })

  it('blocks free user at limit with UPGRADE_REQUIRED', async () => {
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(
      { id: 'u1', plan: 'FREE', role: 'user', auditsUsed: 3, auditsLimit: 3 },
      0,
    )
    expect(result.allowed).toBe(false)
    expect(result.code).toBe('UPGRADE_REQUIRED')
    expect(result.action).toBe('upgrade')
  })

  it('blocks paid user at limit with TOKEN_LIMIT', async () => {
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(
      { id: 'u2', plan: 'BUILDER', role: 'user', auditsUsed: 25, auditsLimit: 25 },
      0,
    )
    expect(result.allowed).toBe(false)
    expect(result.code).toBe('TOKEN_LIMIT')
    expect(result.action).toBe('buy_credits')
  })

  it('allows paid user at limit when purchased credits are available', async () => {
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 10 } })
    const result = await wouldBlockNewCheckWithCredits(
      { id: 'u2', plan: 'BUILDER', role: 'user', auditsUsed: 25, auditsLimit: 25 },
      0,
    )
    expect(result).toEqual({ allowed: true })
  })

  it('accounts for pending checks when computing capacity', async () => {
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(
      { id: 'u1', plan: 'FREE', role: 'user', auditsUsed: 3, auditsLimit: 3 },
      1,
    )
    expect(result.allowed).toBe(false)
  })

  it('allows when plan + credits exceed pending', async () => {
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 5 } })
    const result = await wouldBlockNewCheckWithCredits(
      { id: 'u2', plan: 'BUILDER', role: 'user', auditsUsed: 25, auditsLimit: 25 },
      3,
    )
    expect(result).toEqual({ allowed: true })
  })
})

// ── consumePurchasedCredit ───────────────────────────────────────

describe('consumePurchasedCredit', () => {
  it('returns true and decrements oldest pack', async () => {
    mockFindFirst.mockResolvedValue({ id: 'pack1', creditsRemaining: 10 })
    mockUpdate.mockResolvedValue({})
    const result = await consumePurchasedCredit(
      { creditPurchase: { findFirst: mockFindFirst, update: mockUpdate } } as never,
      'user1',
    )
    expect(result).toBe(true)
    expect(mockFindFirst).toHaveBeenCalledWith({
      where: { userId: 'user1', status: 'PAID', creditsRemaining: { gt: 0 } },
      orderBy: { paidAt: 'asc' },
    })
    expect(mockUpdate).toHaveBeenCalledWith({
      where: { id: 'pack1' },
      data: { creditsRemaining: { decrement: 1 } },
    })
  })

  it('returns false when no packs have remaining credits', async () => {
    mockFindFirst.mockResolvedValue(null)
    const result = await consumePurchasedCredit(
      { creditPurchase: { findFirst: mockFindFirst, update: mockUpdate } } as never,
      'user1',
    )
    expect(result).toBe(false)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})

// ── checkAnonymousAuditAllowed ───────────────────────────────────

describe('checkAnonymousAuditAllowed', () => {
  const mockCookieGet = vi.fn()

  beforeEach(() => {
    vi.mocked(cookies).mockResolvedValue({
      get: mockCookieGet,
    } as never)
  })

  it('allows when dev mode bypass is active', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.DEV_SIMULATE_BILLING
    const result = await checkAnonymousAuditAllowed()
    expect(result).toEqual({ allowed: true })
  })

  it('allows when no cookie exists', async () => {
    mockCookieGet.mockReturnValue(undefined)
    const result = await checkAnonymousAuditAllowed()
    expect(result).toEqual({ allowed: true })
  })

  it('allows when cookie has IDs but none are valid audits', async () => {
    mockCookieGet.mockReturnValue({ value: '["dead-id"]' })
    mockAuditCount.mockResolvedValue(0)
    const result = await checkAnonymousAuditAllowed()
    expect(result).toEqual({ allowed: true })
  })

  it('blocks when cookie has ID matching a valid anonymous audit', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockCookieGet.mockReturnValue({ value: '["real-id"]' })
    mockAuditCount.mockResolvedValue(1)
    const result = await checkAnonymousAuditAllowed()
    expect(result.allowed).toBe(false)
    expect(result.code).toBe('AUTH_REQUIRED')
    expect(result.action).toBe('signup')
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('counts only audits with userId: null from tracked cookie IDs', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockCookieGet.mockReturnValue({ value: '["id1","id2","id3"]' })
    mockAuditCount.mockResolvedValue(2)
    await checkAnonymousAuditAllowed()
    expect(mockAuditCount).toHaveBeenCalledWith({
      where: { id: { in: ['id1', 'id2', 'id3'] }, userId: null },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('handles malformed cookie gracefully', async () => {
    mockCookieGet.mockReturnValue({ value: 'not-json' })
    const result = await checkAnonymousAuditAllowed()
    expect(result).toEqual({ allowed: true })
  })
})

// ── getCheckUsage ────────────────────────────────────────────────

describe('getCheckUsage', () => {
  it('returns unlimited in dev mode with no plan limit', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.DEV_SIMULATE_BILLING
    const result = await getCheckUsage({ id: 'u1', role: 'user', auditsUsed: 5, auditsLimit: 3 })
    expect(result.isUnlimited).toBe(true)
    expect(result.limit).toBeNull()
    expect(result.totalAvailable).toBeNull()
    expect(result.purchasedCredits).toBe(0)
  })

  it('returns plan limit for regular user', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditCount.mockResolvedValue(0)
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 0 } })
    const result = await getCheckUsage({ id: 'u2', role: 'user', auditsUsed: 2, auditsLimit: 25 })
    expect(result.isUnlimited).toBe(false)
    expect(result.limit).toBe(25)
    expect(result.used).toBe(2)
    expect(result.purchasedCredits).toBe(0)
    expect(result.totalAvailable).toBe(23)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('includes pending checks in the response', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditCount.mockResolvedValue(3)
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 0 } })
    const result = await getCheckUsage({ id: 'u3', role: 'user', auditsUsed: 10, auditsLimit: 25 })
    expect(result.pending).toBe(3)
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('includes purchased credits in totalAvailable', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditCount.mockResolvedValue(0)
    mockAggregate.mockResolvedValue({ _sum: { creditsRemaining: 15 } })
    const result = await getCheckUsage({ id: 'u4', role: 'user', auditsUsed: 20, auditsLimit: 25 })
    expect(result.purchasedCredits).toBe(15)
    expect(result.totalAvailable).toBe(20)
    delete process.env.DEV_SIMULATE_BILLING
  })
})

// ── incrementUsageOnCompleteForAudit ─────────────────────────────

describe('incrementUsageOnCompleteForAudit', () => {
  it('returns early in dev mode without billing simulation', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    delete process.env.DEV_SIMULATE_BILLING
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockAuditFindUnique).not.toHaveBeenCalled()
  })

  it('returns early when audit is already counted', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: new Date(),
      aiReviewAt: new Date(),
      skipUsageCount: false,
    })
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockUserUpdate).not.toHaveBeenCalled()
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('increments when prescription is not yet available', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: null,
      skipUsageCount: false,
    })
    mockUserFindUnique
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({ auditsUsed: 1, auditsLimit: 3 })
    mockUserUpdate.mockResolvedValue({})
    mockAuditUpdate.mockResolvedValue({})
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { auditsUsed: { increment: 1 } },
    })
    expect(mockAuditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit1' },
      data: { usageCountedAt: expect.any(Date) },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('marks as counted but does not increment for unlimited users', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: null,
      skipUsageCount: false,
    })
    mockUserFindUnique.mockResolvedValue({ role: 'admin' })
    mockAuditUpdate.mockResolvedValue({})
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockAuditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit1' },
      data: { usageCountedAt: expect.any(Date) },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('marks as counted but does not increment for skipUsageCount audits', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: null,
      skipUsageCount: true,
    })
    mockUserFindUnique.mockResolvedValue({ role: 'user' })
    mockAuditUpdate.mockResolvedValue({})
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockAuditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit1' },
      data: { usageCountedAt: expect.any(Date) },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('increments auditsUsed when under plan limit', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: null,
      skipUsageCount: false,
    })
    mockUserFindUnique
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({ auditsUsed: 2, auditsLimit: 25 })
    mockUserUpdate.mockResolvedValue({})
    mockAuditUpdate.mockResolvedValue({})
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { auditsUsed: { increment: 1 } },
    })
    expect(mockAuditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit1' },
      data: { usageCountedAt: expect.any(Date) },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('consumes purchased credit when at plan limit', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: null,
      skipUsageCount: false,
    })
    mockUserFindUnique
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({ auditsUsed: 25, auditsLimit: 25 })
    mockFindFirst.mockResolvedValue({ id: 'pack1', creditsRemaining: 10 })
    mockUpdate.mockResolvedValue({})
    mockAuditUpdate.mockResolvedValue({})
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockFindFirst).toHaveBeenCalled()
    expect(mockUpdate).toHaveBeenCalled()
    expect(mockUserUpdate).not.toHaveBeenCalled()
    expect(mockAuditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit1' },
      data: { usageCountedAt: expect.any(Date) },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })

  it('increments auditsUsed past limit when no credits available', async () => {
    process.env.DEV_SIMULATE_BILLING = 'true'
    mockAuditFindUnique.mockResolvedValue({
      id: 'audit1',
      userId: 'user1',
      usageCountedAt: null,
      skipUsageCount: false,
    })
    mockUserFindUnique
      .mockResolvedValueOnce({ role: 'user' })
      .mockResolvedValueOnce({ auditsUsed: 25, auditsLimit: 25 })
    mockFindFirst.mockResolvedValue(null)
    mockAuditUpdate.mockResolvedValue({})
    await incrementUsageOnCompleteForAudit('audit1', 'user1')
    expect(mockUserUpdate).toHaveBeenCalledWith({
      where: { id: 'user1' },
      data: { auditsUsed: { increment: 1 } },
    })
    expect(mockAuditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit1' },
      data: { usageCountedAt: expect.any(Date) },
    })
    delete process.env.DEV_SIMULATE_BILLING
  })
})
