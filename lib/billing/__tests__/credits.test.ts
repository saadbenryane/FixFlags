import { beforeEach, describe, expect, it, vi } from 'vitest'

const creditPurchaseMock = vi.hoisted(() => ({
  aggregate: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { creditPurchase: creditPurchaseMock },
}))

import {
  CREDIT_PACKS,
  consumePurchasedCredit,
  getCreditPack,
  getCreditPackStripePriceId,
  getPurchasedCreditsRemaining,
  getTotalAvailableCredits,
  refundPurchasedCredit,
  wouldBlockNewCheckWithCredits,
} from '@/lib/billing/credits'

describe('credit packs', () => {
  it('looks up packs by id and exposes their stripe price id', () => {
    expect(getCreditPack('pack_10')?.credits).toBe(10)
    expect(getCreditPack('pack_50')?.label).toBe('+50 audits')
    expect(getCreditPack('missing')).toBeUndefined()
    expect(getCreditPackStripePriceId('pack_25')).toBeUndefined()
    expect(getCreditPackStripePriceId('missing')).toBeUndefined()
  })

  it('declares packs in ascending value order with fixed prices', () => {
    expect(CREDIT_PACKS.map((p) => p.id)).toEqual(['pack_10', 'pack_25', 'pack_50'])
    expect(CREDIT_PACKS.map((p) => p.priceUsdCents)).toEqual([1500, 3000, 5000])
    expect(CREDIT_PACKS.find((p) => p.id === 'pack_10')?.popular).toBe(true)
  })
})

describe('getPurchasedCreditsRemaining', () => {
  it('sums remaining credits across paid packs', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({
      _sum: { creditsRemaining: 7 },
    })
    await expect(getPurchasedCreditsRemaining('user-1')).resolves.toBe(7)
    expect(creditPurchaseMock.aggregate).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'PAID' },
      _sum: { creditsRemaining: true },
    })
  })

  it('returns 0 when the aggregate sum is null', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({ _sum: { creditsRemaining: null } })
    await expect(getPurchasedCreditsRemaining('user-1')).resolves.toBe(0)
  })
})

describe('getTotalAvailableCredits', () => {
  it('adds remaining plan quota to purchased credits', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({
      _sum: { creditsRemaining: 2 },
    })
    const total = await getTotalAvailableCredits({
      id: 'user-1',
      auditsUsed: 1,
      auditsLimit: 3,
      role: 'user',
    })
    expect(total).toBe(4)
  })

  it('never reports negative plan remainder', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({
      _sum: { creditsRemaining: 0 },
    })
    const total = await getTotalAvailableCredits({
      id: 'user-1',
      auditsUsed: 10,
      auditsLimit: 3,
      role: 'user',
    })
    expect(total).toBe(0)
  })
})

describe('consumePurchasedCredit', () => {
  const tx = { creditPurchase: creditPurchaseMock }

  // resetAllMocks wipes queued mockResolvedValueOnce values that earlier
  // tests may have queued but never consumed (early returns before the
  // aggregate call), which would otherwise leak into the next test.
  beforeEach(() => vi.resetAllMocks())

  it('consumes from the oldest paid pack first', async () => {
    creditPurchaseMock.findFirst.mockResolvedValueOnce({ id: 'pack-oldest' })
    creditPurchaseMock.update.mockResolvedValueOnce({})

    await expect(consumePurchasedCredit(tx as never, 'user-1')).resolves.toBe(true)
    expect(creditPurchaseMock.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', status: 'PAID', creditsRemaining: { gt: 0 } },
      orderBy: { paidAt: 'asc' },
    })
    expect(creditPurchaseMock.update).toHaveBeenCalledWith({
      where: { id: 'pack-oldest' },
      data: { creditsRemaining: { decrement: 1 } },
    })
  })

  it('returns false when no paid pack has credits', async () => {
    creditPurchaseMock.findFirst.mockResolvedValueOnce(null)
    await expect(consumePurchasedCredit(tx as never, 'user-1')).resolves.toBe(false)
    expect(creditPurchaseMock.update).not.toHaveBeenCalled()
  })
})

describe('refundPurchasedCredit', () => {
  const tx = { creditPurchase: creditPurchaseMock }

  // resetAllMocks wipes queued mockResolvedValueOnce values that earlier
  // tests may have queued but never consumed (early returns before the
  // aggregate call), which would otherwise leak into the next test.
  beforeEach(() => vi.resetAllMocks())

  it('voids the matching paid purchase', async () => {
    creditPurchaseMock.findFirst.mockResolvedValueOnce({ id: 'pack-1' })
    creditPurchaseMock.update.mockResolvedValueOnce({})

    await expect(
      refundPurchasedCredit(tx as never, 'pi_123')
    ).resolves.toBe(true)
    expect(creditPurchaseMock.update).toHaveBeenCalledWith({
      where: { id: 'pack-1' },
      data: { status: 'REFUNDED', creditsRemaining: 0 },
    })
  })

  it('returns false when no purchase matches the payment intent', async () => {
    creditPurchaseMock.findFirst.mockResolvedValueOnce(null)
    await expect(refundPurchasedCredit(tx as never, 'pi_missing')).resolves.toBe(false)
    expect(creditPurchaseMock.update).not.toHaveBeenCalled()
  })
})

describe('wouldBlockNewCheckWithCredits', () => {
  const baseUser = {
    id: 'user-1',
    plan: 'BUILDER' as const,
    role: 'user' as const,
    auditsUsed: 2,
    auditsLimit: 3,
  }

  // resetAllMocks wipes queued mockResolvedValueOnce values that earlier
  // tests may have queued but never consumed (early returns before the
  // aggregate call), which would otherwise leak into the next test.
  beforeEach(() => vi.resetAllMocks())

  it('allows when plan quota covers the pending checks', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(baseUser, 0)
    expect(result).toEqual({ allowed: true })
  })

  it('allows when purchased credits cover the pending checks', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({ _sum: { creditsRemaining: 2 } })
    const result = await wouldBlockNewCheckWithCredits({ ...baseUser, auditsUsed: 3 }, 1)
    expect(result).toEqual({ allowed: true })
  })

  it('blocks a free user at the cap with UPGRADE_REQUIRED', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(
      { ...baseUser, plan: 'FREE', auditsUsed: 3 },
      0
    )
    expect(result).toEqual({
      allowed: false,
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
      error: 'New URL check limit reached. Upgrade to continue.',
    })
  })

  it('blocks a paid user at the cap with TOKEN_LIMIT and buy_credits', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({ _sum: { creditsRemaining: 0 } })
    const result = await wouldBlockNewCheckWithCredits(
      { ...baseUser, auditsUsed: 3 },
      0
    )
    expect(result).toEqual({
      allowed: false,
      code: 'TOKEN_LIMIT',
      action: 'buy_credits',
      error: 'New URL check limit reached. Buy credits or upgrade your plan to continue.',
    })
  })

  it('treats equality with pending as blocked', async () => {
    creditPurchaseMock.aggregate.mockResolvedValueOnce({ _sum: { creditsRemaining: 1 } })
    const result = await wouldBlockNewCheckWithCredits({ ...baseUser, auditsUsed: 3 }, 1)
    expect(result.allowed).toBe(false)
  })
})
