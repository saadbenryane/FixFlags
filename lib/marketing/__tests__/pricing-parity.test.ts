import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { PLANS, PRICING, PRICING_FAQ } from '@/lib/marketing/copy/plans'
import { AUTH, SCAN_LIMIT_GATE } from '@/lib/marketing/copy/auth'
import { SEO } from '@/lib/marketing/copy/seo'

const ROOT = join(process.cwd(), 'lib/marketing/copy')
const HELP_CATALOG = readFileSync(join(ROOT, '../../help/catalog.ts'), 'utf8')

const OBSOLETE_PLAN_COPY = [
  /3 product reviews \(lifetime\)/i,
  /deep review teaser/i,
  /\$69/i,
  /\$199/i,
  /25 product reviews/i,
  /80 product reviews/i,
  /15 product reviews per month/i,
  /50 product reviews per month/i,
  /15 reviews each month/i,
  /50 reviews, unlimited products/i,
]

const FREE = PLAN_DEFINITIONS.FREE
const BUILDER = PLAN_DEFINITIONS.BUILDER
const TEAM = PLAN_DEFINITIONS.TEAM

describe('pricing parity', () => {
  it('keeps Free marketing numbers aligned with billing enforcement', () => {
    expect(PRICING_COPY.freeProductReviewsPerMonth).toBe(FREE.auditLimit)
  })

  it('keeps Pro marketing numbers aligned with billing enforcement', () => {
    expect(PRICING_COPY.proPrice).toBe(BUILDER.price)
    expect(PRICING_COPY.proPeriod).toBe(BUILDER.period)
    expect(PRICING_COPY.proProductReviewsPerMonth).toBe(BUILDER.auditLimit)
  })

  it('keeps Studio marketing numbers aligned with billing enforcement', () => {
    expect(PRICING_COPY.studioPrice).toBe(TEAM.price)
    expect(PRICING_COPY.studioPeriod).toBe(TEAM.period)
    expect(PRICING_COPY.studioProductReviewsPerMonth).toBe(TEAM.auditLimit)
  })

  it('drives the marketing plan cards from the Shopify free offer', () => {
    expect(PLANS.find((plan) => plan.plan === 'FREE')).toMatchObject({
      price: '$0',
      products: '1 store',
      cta: 'Install on Shopify',
    })
    expect(PLANS.find((plan) => plan.plan === 'BUILDER')).toMatchObject({
      price: 'Waitlist',
      cta: 'Join Pro waitlist',
    })
    expect(PLANS.find((plan) => plan.plan === 'TEAM')).toMatchObject({
      cta: 'Join Studio waitlist',
    })
  })

  it('gives each paid plan a concrete reason to join the waitlist', () => {
    const pro = PLANS.find((plan) => plan.plan === 'BUILDER')!
    const studio = PLANS.find((plan) => plan.plan === 'TEAM')!

    expect(pro.features.join('\n')).toMatch(/extra purchase paths/i)
    expect(pro.features.join('\n')).toMatch(/faster cadence/i)
    expect(pro.features.join('\n')).toMatch(/funnel analytics/i)
    expect(studio.features.join('\n')).toMatch(/multiple stores/i)
    expect(studio.price).toBe('Waitlist')
  })

  it('avoids inheritance shorthand and internal metering language', () => {
    const customerSurfaces = JSON.stringify({ PLANS, PRICING })
    expect(customerSurfaces).not.toMatch(/everything in (free|pro|studio)/i)
    expect(customerSurfaces).not.toMatch(/shared by new and update/i)
    expect(customerSurfaces).not.toMatch(/run update reviews manually/i)
  })

  it('uses the monthly usage ladder on customer surfaces', () => {
    const surfaces = [
      JSON.stringify(AUTH.signUp),
      JSON.stringify(SCAN_LIMIT_GATE),
      JSON.stringify(SEO.pricing),
      PRICING.pickerSubtitle,
      HELP_CATALOG,
    ].join('\n')

    for (const pattern of OBSOLETE_PLAN_COPY) {
      expect(surfaces).not.toMatch(pattern)
    }

    expect(surfaces).toMatch(/per month/i)
  })

  it('keeps anonymous signup copy free of upgrade language', () => {
    expect(AUTH.signUp.subtitle).not.toMatch(/upgrade/i)
    expect(AUTH.signUp.fromPricing).not.toMatch(/upgrade/i)
    expect(SCAN_LIMIT_GATE.signup.title).not.toMatch(/upgrade/i)
    expect(SCAN_LIMIT_GATE.signup.body).not.toMatch(/upgrade/i)
  })

  it('sells the free Shopify walk without a current deep-review quota', () => {
    const customerSurfaces = [JSON.stringify(PLANS), JSON.stringify(PRICING), HELP_CATALOG].join('\n')

    expect(customerSurfaces).not.toMatch(/deep reviews? (?:per month|included|allowance)/i)
    expect(customerSurfaces).toMatch(/purchase paths/i)
    expect(customerSurfaces).not.toMatch(/\$29/)
    expect(customerSurfaces).not.toMatch(/\$99/)
  })

  it('describes the free Shopify path without crawler jargon', () => {
    const free = PLANS.find((plan) => plan.plan === 'FREE')!
    const pro = PLANS.find((plan) => plan.plan === 'BUILDER')!

    expect(free.features.join('\n')).toMatch(/purchase paths/i)
    expect(free.features.join('\n')).toMatch(/video/i)
    expect(pro.features.join('\n')).toMatch(/extra purchase paths/i)

    const surfaces = JSON.stringify({ PLANS, PRICING })
    expect(surfaces).not.toMatch(/\b(hops?|crawler)\b/i)
    expect(surfaces).not.toMatch(/deep review/i)
  })

  it('links pricing FAQ entries to help articles without charging copy', () => {
    expect(PRICING_FAQ.length).toBeGreaterThan(0)
    expect(PRICING_FAQ.every((entry) => entry.learnMore?.href && entry.learnMore.label)).toBe(true)

    const includedPlanAnswer = PRICING_FAQ.find(
      (entry) => entry.question === 'What does the free install include?',
    )!
    expect(includedPlanAnswer.answer).toMatch(/video/i)
    expect(includedPlanAnswer.answer).toMatch(/rechecks/i)
    expect(PRICING_FAQ.map((entry) => entry.answer).join('\n')).not.toMatch(/\$29|\$99/)
  })
})
