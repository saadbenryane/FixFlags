import { describe, it, expect } from 'vitest'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { PLANS } from '@/lib/marketing/copy/plans'

const FREE = PLAN_DEFINITIONS.FREE
const BUILDER = PLAN_DEFINITIONS.BUILDER
const TEAM = PLAN_DEFINITIONS.TEAM

describe('pricing parity', () => {
  it('keeps Free marketing numbers aligned with billing enforcement', () => {
    expect(PRICING_COPY.freeProductReviewsLifetime).toBe(FREE.auditLimit)
    expect(PRICING_COPY.freeDeepReviewTeaserLifetime).toBe(FREE.deepReviewLimit)
  })

  it('keeps Pro marketing numbers aligned with billing enforcement', () => {
    expect(PRICING_COPY.proPrice).toBe(BUILDER.price)
    expect(PRICING_COPY.proPeriod).toBe(BUILDER.period)
    expect(PRICING_COPY.proProductReviewsPerMonth).toBe(BUILDER.auditLimit)
    expect(PRICING_COPY.proDeepReviewsPerMonth).toBe(BUILDER.deepReviewLimit)
  })

  it('keeps Studio marketing numbers aligned with billing enforcement', () => {
    expect(PRICING_COPY.studioPrice).toBe(TEAM.price)
    expect(PRICING_COPY.studioPeriod).toBe(TEAM.period)
    expect(PRICING_COPY.studioProductReviewsPerMonth).toBe(TEAM.auditLimit)
    expect(PRICING_COPY.studioDeepReviewsPerMonth).toBe(TEAM.deepReviewLimit)
  })

  it('drives the marketing plan cards from PRICING_COPY', () => {
    expect(PLANS.find((plan) => plan.plan === 'FREE')).toMatchObject({
      price: '$0',
    })
    expect(PLANS.find((plan) => plan.plan === 'BUILDER')).toMatchObject({
      price: PRICING_COPY.proPrice,
      period: PRICING_COPY.proPeriod,
      audits: `${PRICING_COPY.proProductReviewsPerMonth} product reviews / month`,
    })
    expect(PLANS.find((plan) => plan.plan === 'TEAM')).toMatchObject({
      price: PRICING_COPY.studioPrice,
      period: PRICING_COPY.studioPeriod,
      audits: `${PRICING_COPY.studioProductReviewsPerMonth} product reviews / month`,
    })
  })
})
