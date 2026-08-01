import { describe, expect, it } from 'vitest'
import {
  FOUNDER_OFFER_ID,
  founderCheckoutDiscounts,
  isFounderOfferEligible,
} from '@/lib/billing/founder-offers'

describe('founder offers', () => {
  it('blocks second redemption after founderOfferRedeemedAt', () => {
    expect(
      isFounderOfferEligible({ founderOfferRedeemedAt: new Date('2026-01-01') })
    ).toBe(false)
  })

  it('returns no discounts when already redeemed', () => {
    expect(
      founderCheckoutDiscounts('BUILDER', { founderOfferRedeemedAt: new Date() })
    ).toBeUndefined()
  })

  it('uses stable offer id constant', () => {
    expect(FOUNDER_OFFER_ID).toBe('founder_40_12m')
  })
})
