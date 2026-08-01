import { describe, expect, it, vi, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  paidPlanWaitlistEntry: { findUnique: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/billing/paid-open', () => ({ isPaidOpenServer: () => true }))

import {
  FOUNDER_OFFER_ID,
  founderCheckoutDiscounts,
  isFounderOfferEligible,
} from '@/lib/billing/founder-offers'

describe('founder offers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue({ id: 'entry-1' })
    process.env.STRIPE_FOUNDER_PRO_PROMOTION_ID = 'promo_pro'
    process.env.STRIPE_FOUNDER_STUDIO_PROMOTION_ID = 'promo_studio'
  })

  it('blocks second redemption after founderOfferRedeemedAt', async () => {
    expect(
      await isFounderOfferEligible(
        { id: 'u1', founderOfferRedeemedAt: new Date('2026-01-01') },
        'BUILDER'
      )
    ).toBe(false)
  })

  it('requires waitlist membership for the target plan', async () => {
    prismaMock.paidPlanWaitlistEntry.findUnique.mockResolvedValue(null)
    expect(
      await isFounderOfferEligible({ id: 'u1', founderOfferRedeemedAt: null }, 'BUILDER')
    ).toBe(false)
  })

  it('returns no discounts when already redeemed', async () => {
    expect(
      await founderCheckoutDiscounts('BUILDER', {
        id: 'u1',
        founderOfferRedeemedAt: new Date(),
      })
    ).toBeUndefined()
  })

  it('returns promotion when eligible and configured', async () => {
    const discounts = await founderCheckoutDiscounts('BUILDER', {
      id: 'u1',
      founderOfferRedeemedAt: null,
    })
    expect(discounts).toEqual([{ promotion_code: 'promo_pro' }])
  })

  it('uses stable offer id constant', () => {
    expect(FOUNDER_OFFER_ID).toBe('founder_40_12m')
  })
})
