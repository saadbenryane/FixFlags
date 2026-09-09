import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_DEFINITIONS } from '@/lib/billing/plans'
import { PLANS, PRICING, PRICING_COMPARISON, PRICING_FAQ } from '@/lib/marketing/copy/plans'
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
const MARKETING_FREE = PLANS.find((plan) => plan.plan === 'FREE')!
const MARKETING_PRO = PLANS.find((plan) => plan.plan === 'BUILDER')!
const MARKETING_STUDIO = PLANS.find((plan) => plan.plan === 'TEAM')!

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

  it('drives the marketing plan cards from per-site monitoring', () => {
    expect(MARKETING_FREE).toMatchObject({
      price: '$0',
      products: '1 website',
      cta: 'Check my website',
      href: '/new',
    })
    expect(MARKETING_PRO).toMatchObject({
      price: '$49',
      period: '/website/mo',
      cta: 'Request a demo',
      href: '/request-demo?plan=pro',
    })
    expect(MARKETING_STUDIO).toMatchObject({
      price: 'Volume',
      cta: 'Request a demo',
      href: '/request-demo?plan=studio',
    })
  })

  it('sells two frequencies and never unlimited Sites', () => {
    const blob = JSON.stringify({ PLANS, PRICING, PRICING_COMPARISON, PRICING_FAQ })
    expect(blob).toMatch(/every 24 hours/i)
    expect(blob).toMatch(/up to every hour/i)
    expect(blob).toMatch(/\$49/)
    expect(blob).toMatch(/24\/7/)
    expect(blob).not.toMatch(/unlimited Sites/i)
    expect(blob).not.toMatch(/\b3\/30\/90\b/)
    expect(blob).not.toMatch(/720 checks/i)
    expect(blob).not.toMatch(/looked after/i)
    expect(blob).not.toMatch(/Keep watching/i)
    expect(blob).not.toMatch(/Join Pro waitlist/)
    expect(blob).not.toMatch(/Waitlist/)
    expect(PRICING.headline).toBe('24/7 website monitoring.')
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

  it('sells the free Site check without a current deep-review quota', () => {
    const customerSurfaces = [JSON.stringify(PLANS), JSON.stringify(PRICING), HELP_CATALOG].join('\n')

    expect(customerSurfaces).not.toMatch(/deep reviews? (?:per month|included|allowance)/i)
    expect(customerSurfaces).toMatch(/Flags/i)
    expect(customerSurfaces).not.toMatch(/\$29/)
    expect(customerSurfaces).not.toMatch(/\$99/)
  })

  it('describes monitoring without crawler jargon or a public check pool', () => {
    expect(MARKETING_FREE.features.join('\n')).toMatch(/24\/7 monitoring/i)
    expect(MARKETING_FREE.features.join('\n')).toMatch(/Flags/i)
    expect(MARKETING_PRO.features.join('\n')).toMatch(/every hour/i)
    expect(MARKETING_PRO.features.join('\n')).not.toMatch(/\b30\b/)
    expect(JSON.stringify(PLANS)).not.toMatch(/product reviews/i)

    const surfaces = JSON.stringify({ PLANS, PRICING })
    expect(surfaces).not.toMatch(/\b(hops?|crawler)\b/i)
    expect(surfaces).not.toMatch(/deep review/i)
  })

  it('links pricing FAQ entries to help articles without charging copy', () => {
    expect(PRICING_FAQ.length).toBeGreaterThan(0)
    expect(PRICING_FAQ.every((entry) => entry.learnMore?.href && entry.learnMore.label)).toBe(true)

    const includedPlanAnswer = PRICING_FAQ.find(
      (entry) => entry.question === 'What does free include?',
    )!
    expect(includedPlanAnswer.answer).toMatch(/Flags/i)
    expect(includedPlanAnswer.answer).toMatch(/verify/i)
    expect(PRICING_FAQ.map((entry) => entry.answer).join('\n')).not.toMatch(/\$29|\$99/)
  })
})
