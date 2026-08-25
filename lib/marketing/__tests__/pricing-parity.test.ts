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

const OBSOLETE_PLAN_COPY = [
  /3 product reviews \(lifetime\)/i,
  /deep review teaser/i,
  /\$69/i,
  /\$199/i,
  /25 product reviews/i,
  /80 product reviews/i,
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

  it('drives the marketing plan cards from PRICING_COPY', () => {
    expect(PLANS.find((plan) => plan.plan === 'FREE')).toMatchObject({
      price: '$0',
      audits: `${PRICING_COPY.freeProductReviewsPerMonth} product reviews / month`,
      products: '1 product',
      cta: 'Start free',
    })
    expect(PLANS.find((plan) => plan.plan === 'BUILDER')).toMatchObject({
      price: PRICING_COPY.proPrice,
      period: PRICING_COPY.proPeriod,
      audits: `${PRICING_COPY.proProductReviewsPerMonth} product reviews / month`,
      products: 'Up to 5 products',
      cta: 'Join Pro waitlist',
    })
    expect(PLANS.find((plan) => plan.plan === 'TEAM')).toMatchObject({
      price: PRICING_COPY.studioPrice,
      period: PRICING_COPY.studioPeriod,
      audits: `${PRICING_COPY.studioProductReviewsPerMonth} product reviews / month`,
      products: 'Unlimited products',
      cta: 'Join Studio waitlist',
    })
  })

  it('gives each paid plan a concrete reason to upgrade', () => {
    const pro = PLANS.find((plan) => plan.plan === 'BUILDER')!
    const studio = PLANS.find((plan) => plan.plan === 'TEAM')!

    expect(pro.features.join('\n')).toMatch(/history across releases/i)
    expect(pro.features.join('\n')).toMatch(/compare releases/i)
    expect(studio.features.join('\n')).toMatch(/scheduled reviews/i)
    expect(studio.features.join('\n')).toMatch(/invite people/i)
    expect(studio.accountModel).toMatch(/unlimited workspace seats.*limited time/i)
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

  it('sells one Product Review allowance without a current deep-review quota', () => {
    const customerSurfaces = [JSON.stringify(PLANS), JSON.stringify(PRICING), HELP_CATALOG].join('\n')

    expect(customerSurfaces).not.toMatch(/deep reviews? (?:per month|included|allowance)/i)
    expect(customerSurfaces).toMatch(/product reviews? per month/i)
  })
})
