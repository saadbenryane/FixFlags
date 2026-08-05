import { describe, expect, it, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  paidPlanWaitlistEntry: { findUnique: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/billing/paid-open', () => ({ isPaidOpenServer: vi.fn(() => true) }))

import {
  TIER_1_CAP,
  TIER_2_CAP,
  TIER_PERCENT,
  TIER_DURATION_MONTHS,
  discountTierForPosition,
  isDiscountWindowActive,
  tierPromoRedeemBy,
  tierPromotionIdForPlan,
  tierCheckoutDiscounts,
} from '@/lib/billing/discount-tiers'

const RELEASE = '2026-09-01T00:00:00.000Z'

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.PLAN_RELEASE_DATE
  delete process.env.STRIPE_TIER1_PRO_PROMOTION_ID
  delete process.env.STRIPE_TIER1_STUDIO_PROMOTION_ID
  delete process.env.STRIPE_TIER2_PRO_PROMOTION_ID
  delete process.env.STRIPE_TIER2_STUDIO_PROMOTION_ID
})

describe('discountTierForPosition', () => {
  it('assigns tier 1 to positions 1..500', () => {
    expect(discountTierForPosition(1)).toBe(1)
    expect(discountTierForPosition(TIER_1_CAP)).toBe(1)
  })

  it('assigns tier 2 to positions 501..1000', () => {
    expect(discountTierForPosition(TIER_1_CAP + 1)).toBe(2)
    expect(discountTierForPosition(TIER_2_CAP)).toBe(2)
  })

  it('assigns no tier past position 1000', () => {
    expect(discountTierForPosition(TIER_2_CAP + 1)).toBeNull()
  })

  it('caps never overshoot: exactly 500 tier-1 and 500 tier-2 slots per plan', () => {
    const counts = { 1: 0, 2: 0, none: 0 }
    for (let position = 1; position <= 1200; position++) {
      const tier = discountTierForPosition(position)
      if (tier === 1) counts[1]++
      else if (tier === 2) counts[2]++
      else counts.none++
    }
    expect(counts[1]).toBe(500)
    expect(counts[2]).toBe(500)
    expect(counts.none).toBe(200)
  })
})

describe('discount window (PLAN_RELEASE_DATE)', () => {
  it('is inactive when PLAN_RELEASE_DATE is unset or invalid', () => {
    expect(isDiscountWindowActive(new Date('2026-09-15T00:00:00.000Z'))).toBe(false)
    process.env.PLAN_RELEASE_DATE = 'not-a-date'
    expect(isDiscountWindowActive(new Date('2026-09-15T00:00:00.000Z'))).toBe(false)
  })

  it('is inactive before plan release', () => {
    process.env.PLAN_RELEASE_DATE = RELEASE
    expect(isDiscountWindowActive(new Date('2026-08-31T23:59:59.000Z'))).toBe(false)
  })

  it('is active from release through release + 12 months', () => {
    process.env.PLAN_RELEASE_DATE = RELEASE
    expect(isDiscountWindowActive(new Date('2026-09-01T00:00:00.000Z'))).toBe(true)
    expect(isDiscountWindowActive(new Date('2027-08-31T23:59:59.000Z'))).toBe(true)
  })

  it('expires 12 months after release (not from activation)', () => {
    process.env.PLAN_RELEASE_DATE = RELEASE
    expect(isDiscountWindowActive(new Date('2027-09-01T00:00:00.000Z'))).toBe(false)
  })

  it('computes Stripe redeem_by as release + 12 months', () => {
    process.env.PLAN_RELEASE_DATE = RELEASE
    const redeemBy = tierPromoRedeemBy()
    expect(redeemBy).toBe(Math.floor(new Date('2027-09-01T00:00:00.000Z').getTime() / 1000))
  })
})

describe('tier promotion env lookup', () => {
  it('maps tier+plan to the configured env var', () => {
    process.env.STRIPE_TIER1_PRO_PROMOTION_ID = 'promo_t1_pro'
    process.env.STRIPE_TIER2_STUDIO_PROMOTION_ID = 'promo_t2_studio'
    expect(tierPromotionIdForPlan(1, 'BUILDER')).toBe('promo_t1_pro')
    expect(tierPromotionIdForPlan(2, 'TEAM')).toBe('promo_t2_studio')
    expect(tierPromotionIdForPlan(2, 'BUILDER')).toBeUndefined()
  })
})

describe('tierCheckoutDiscounts', () => {
  beforeEach(() => {
    // Release date in the past so the window is active at test time.
    process.env.PLAN_RELEASE_DATE = '2026-07-01T00:00:00.000Z'
    process.env.STRIPE_TIER1_PRO_PROMOTION_ID = 'promo_t1_pro'
    process.env.STRIPE_TIER2_PRO_PROMOTION_ID = 'promo_t2_pro'
  })

  it('returns the tier promotion when the user has a waitlist tier', async () => {
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      discountTier: 1,
    })
    expect(await tierCheckoutDiscounts('BUILDER', 'user-1')).toEqual({
      tier: 1,
      promotion_code: 'promo_t1_pro',
    })

    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-2',
      discountTier: 2,
    })
    expect(await tierCheckoutDiscounts('BUILDER', 'user-2')).toEqual({
      tier: 2,
      promotion_code: 'promo_t2_pro',
    })
  })

  it('returns null for waitlist members without a tier', async () => {
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      discountTier: null,
    })
    expect(await tierCheckoutDiscounts('BUILDER', 'user-1')).toBeNull()
  })

  it('returns null when the user is not on the waitlist', async () => {
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    expect(await tierCheckoutDiscounts('BUILDER', 'user-1')).toBeNull()
  })

  it('returns null when the tier promotion is not configured', async () => {
    delete process.env.STRIPE_TIER1_PRO_PROMOTION_ID
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      discountTier: 1,
    })
    expect(await tierCheckoutDiscounts('BUILDER', 'user-1')).toBeNull()
  })

  it('returns null when the discount window is inactive', async () => {
    process.env.PLAN_RELEASE_DATE = '2030-01-01'
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({
      id: 'entry-1',
      discountTier: 1,
    })
    expect(await tierCheckoutDiscounts('BUILDER', 'user-1')).toBeNull()
  })

  it('checks the plan the user joined, not any plan', async () => {
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    expect(await tierCheckoutDiscounts('TEAM', 'user-1')).toBeNull()
    expect(prismaMock.paidPlanWaitlistEntry.findUnique).toHaveBeenCalledWith({
      where: { userId_plan: { userId: 'user-1', plan: 'TEAM' } },
      select: { discountTier: true },
    })
  })
})

describe('tier constants', () => {
  it('exposes 25%/15% per tier for 12 months', () => {
    expect(TIER_PERCENT).toEqual({ 1: 25, 2: 15 })
    expect(TIER_DURATION_MONTHS).toBe(12)
  })
})
