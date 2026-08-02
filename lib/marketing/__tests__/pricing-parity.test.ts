import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { PLANS, PRICING } from '@/lib/marketing/copy/plans'
import { AUTH, SCAN_LIMIT_GATE } from '@/lib/marketing/copy/auth'
import { SEO } from '@/lib/marketing/copy/seo'

const ROOT = join(process.cwd(), 'lib/marketing/copy')
const HELP_CATALOG = readFileSync(join(ROOT, '../../help/catalog.ts'), 'utf8')
const DEEP_REVIEW_DOC = readFileSync(join(process.cwd(), 'content/docs/deep-review.md'), 'utf8')

const FREE_LIFETIME_FORBIDDEN = [
  /3 product reviews per month/i,
  /teaser per month/i,
  /free product reviews this month/i,
]

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

  it('never describes Free tier product reviews as monthly in customer surfaces', () => {
    const surfaces = [
      JSON.stringify(AUTH.signUp),
      JSON.stringify(SCAN_LIMIT_GATE),
      JSON.stringify(SEO.pricing),
      PRICING.pickerSubtitle,
      HELP_CATALOG,
      DEEP_REVIEW_DOC,
    ].join('\n')

    for (const pattern of FREE_LIFETIME_FORBIDDEN) {
      expect(surfaces).not.toMatch(pattern)
    }

    expect(surfaces).toMatch(/lifetime/i)
  })
})
