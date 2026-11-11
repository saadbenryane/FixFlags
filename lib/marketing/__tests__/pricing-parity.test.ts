import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { PLAN_DEFINITIONS, LEGACY_PRICE_ALLOWANCES, planLabel } from '@/lib/billing/plans'
import { PLANNED_ADD_ON_PRICING, PLANNED_PAID_PRICING } from '@/lib/billing/beta-policy'
import { WAITLIST_PLAN_BY_SEGMENT, waitlistPathForPlan } from '@/lib/billing/waitlist-path'
import { PLANS, PRICING, WAITLIST_PAGE, BILLING_ACTION_COPY } from '@/lib/marketing/copy/plans'
import { PRICING_ADD_ONS, PRICING_PAGE_FAQ, PRICING_PLAN_TABLE, PRICING_TIERS } from '@/lib/marketing/copy/pricing-page'
import { PUBLIC_OFFER } from '@/lib/marketing/copy/public-offer'
import { AUTH } from '@/lib/marketing/copy/auth'
import { SEO } from '@/lib/marketing/copy/seo'
import { FAQ } from '@/lib/marketing/copy/faq'
import { LEGAL_PAGE_META, TERMS_SECTIONS } from '@/lib/marketing/copy/legal'
import { HELP_ARTICLES } from '@/lib/help/catalog'

const PAID_TIERS = [
  { id: 'pro', name: 'Pro', source: PLANNED_PAID_PRICING.BUILDER, segment: 'pro' },
  { id: 'team', name: 'Team', source: PLANNED_PAID_PRICING.TEAM, segment: 'team' },
  { id: 'agency', name: 'Agency', source: PLANNED_PAID_PRICING.AGENCY, segment: 'agency' },
] as const

const helpPricing = HELP_ARTICLES.find(article => article.slug === 'free-and-pro')!
const helpText = JSON.stringify(helpPricing)
const termsText = Object.values(TERMS_SECTIONS).map(section => section.body).join(' ')

/** Every surface that states the paid model. Each must say the same thing. */
const PRICING_SURFACES = {
  publicOffer: PUBLIC_OFFER.paid,
  terms: termsText,
  help: helpText,
  waitlistDescription: BILLING_ACTION_COPY.waitlist.description,
  seoWaitlist: SEO.waitlist.description,
}

/** Old per-website model and retired plan names, as a reader sees them (copy keys may keep internal names). */
const OLD_MODEL = /Studio|\$99|Volume|(?<!Is pricing )[Pp]er website|\/website|website\/mo|website checks per month|website-check allowance|[Qq]uoted/

const source = (path: string) => readFileSync(join(process.cwd(), path), 'utf8')

/** The words a reader sees: every string value, never the internal key names. */
function words(value: unknown): string {
  if (typeof value === 'string') return value
  if (Array.isArray(value)) return value.map(words).join(' ')
  if (value && typeof value === 'object') return Object.values(value).map(words).join(' ')
  return ''
}

describe('one pricing model across every surface', () => {
  it('owns planned prices in beta-policy and renders them on /pricing', () => {
    expect(PLANNED_PAID_PRICING).toEqual({
      BUILDER: { price: '$49', period: '/month', websites: 1 },
      TEAM: { price: '$149', period: '/month', websites: 5 },
      AGENCY: { price: '$399', period: '/month', websites: 25 },
    })
    expect(PLANNED_ADD_ON_PRICING).toEqual({
      extraWebsite: { price: '$19', unit: 'a month each' },
      extraChecks: { price: '$29', unit: 'per 1,000' },
    })
    for (const tier of PAID_TIERS) {
      const rendered = PRICING_TIERS.find(entry => entry.id === tier.id)!
      expect(rendered).toMatchObject({ name: tier.name, price: tier.source.price, period: tier.source.period, websites: tier.source.websites, available: false })
      expect(rendered.cta.href).toBe(`/waitlist/${tier.segment}`)
    }
    expect(PRICING_ADD_ONS.items.map(item => [item.price, item.unit])).toEqual([['$19', 'a month each'], ['$29', 'per 1,000']])
    const websites = PRICING_PLAN_TABLE.rows.find(row => row.feature === 'Websites')!
    expect(websites.cells.map(cell => 'value' in cell ? cell.value : '')).toEqual(['1', '1', '5', '25'])
  })

  it('states every tier, the extra-website fee and the check add-on on each pricing surface', () => {
    for (const [name, text] of Object.entries(PRICING_SURFACES)) {
      for (const tier of PAID_TIERS) {
        expect(text, `${name} names ${tier.name}`).toContain(`${tier.name} ${tier.source.price} a month with ${tier.source.websites} website`)
      }
      expect(text, `${name} states extra websites`).toContain('Extra websites are $19 a month each')
      expect(text, `${name} states extra checks`).toContain('Extra checks and rechecks are $29 per 1,000')
      expect(text, `${name} drops the old model`).not.toMatch(OLD_MODEL)
    }
  })

  it('says priced per account with no automatic charge in Terms, Help and the FAQ', () => {
    for (const text of [termsText, helpText, FAQ.find(entry => entry.question === 'Is FixFlags free?')!.answer]) {
      expect(text).toContain(PUBLIC_OFFER.model)
      expect(text).toMatch(/priced per account/)
    }
    for (const text of [termsText, helpText]) expect(text).toContain(PUBLIC_OFFER.noCharge)
    expect(PUBLIC_OFFER.noCharge).toMatch(/no automatic charge/i)
    expect(PRICING_PAGE_FAQ.find(entry => entry.question === 'Is pricing per website?')!.answer).toMatch(/^No\. Paid plans are priced per account/)
  })

  it('keeps pricing words out of hand-written strings outside the two sources', () => {
    const hardcodedPrice = /['"`][^'"`]*\$[1-9]\d*/
    for (const path of [
      'lib/marketing/copy/public-offer.ts',
      'lib/marketing/copy/legal.ts',
      'lib/marketing/copy/plans.ts',
      'lib/marketing/copy/faq.ts',
      'lib/help/catalog.ts',
    ]) expect(source(path), path).not.toMatch(hardcodedPrice)
    const pricingPage = source('lib/marketing/copy/pricing-page.ts')
    for (const price of ['$19', '$29', '$49', '$149', '$399']) expect(pricingPage).not.toContain(`'${price}'`)
  })

  it('shows in-app plans and billing labels from the same tiers', () => {
    expect(PLANS.map(plan => plan.plan)).toEqual(['FREE', 'BUILDER', 'TEAM'])
    expect(PLANS[1]).toMatchObject({ name: 'Pro', price: '$49', period: '/month', products: '1 website', href: '/waitlist/pro' })
    expect(PLANS[2]).toMatchObject({ name: 'Team', price: '$149', period: '/month', products: '5 websites', href: '/waitlist/team' })
    expect(PLAN_DEFINITIONS.BUILDER).toMatchObject({ label: 'Pro', price: '$49', period: '/month' })
    expect(PLAN_DEFINITIONS.TEAM).toMatchObject({ label: 'Team', price: '$149', period: '/month' })
    expect(planLabel('TEAM')).toBe('Team')
    expect(WAITLIST_PAGE.plans.agency.detail).toContain('$399 a month with 25 websites included')
    expect(PRICING.pickerStudioCta).toBe('Join Team waitlist')
    expect(words({ PLANS, PRICING, WAITLIST_PAGE, BILLING_ACTION_COPY, AUTH, PRICING_TIERS, PRICING_PAGE_FAQ, PLAN_DEFINITIONS })).not.toMatch(OLD_MODEL)
  })

  it('keeps purchased allowances and enforcement unchanged', () => {
    expect(LEGACY_PRICE_ALLOWANCES.BUILDER.auditLimit).toBe(25)
    expect(LEGACY_PRICE_ALLOWANCES.TEAM.auditLimit).toBe(80)
    expect(PLAN_DEFINITIONS.BUILDER.projectLimit).toBe(5)
    expect(PLAN_DEFINITIONS.TEAM.projectLimit).toBeNull()
    expect(PLAN_DEFINITIONS.BUILDER.auditLimit).toBe(30)
    expect(PLAN_DEFINITIONS.TEAM.auditLimit).toBe(90)
  })

  it('routes each paid tier to its own waitlist address', () => {
    expect(WAITLIST_PLAN_BY_SEGMENT).toEqual({ pro: 'BUILDER', team: 'TEAM', agency: 'TEAM' })
    expect(waitlistPathForPlan('BUILDER')).toBe('/waitlist/pro')
    expect(waitlistPathForPlan('TEAM')).toBe('/waitlist/team')
  })
})

describe('open beta on one website', () => {
  it('makes temporary full access and one website consistent across entry surfaces', () => {
    for (const surface of [JSON.stringify(PLANS[0]), PRICING.subhead, AUTH.signUp.subtitle, SEO.pricing.description, TERMS_SECTIONS.accountsAndBilling.body]) {
      expect(surface).toMatch(/beta/i)
      expect(surface).toMatch(/one website|1 website/i)
      expect(surface).toMatch(/no usage limits|without usage limits/i)
    }
    expect(PRICING_PAGE_FAQ.find(faq => faq.question === 'What happens when beta ends?')?.answer).toMatch(/useful Free plan/)
  })

  it('matches the Free plan table to beta behavior: any schedule and deploy checks', () => {
    const free = PRICING_TIERS[0]
    expect(free.features.map(feature => feature.label)).toEqual(expect.arrayContaining(['Any check schedule', 'A check after every deploy']))
    const row = (feature: string) => PRICING_PLAN_TABLE.rows.find(entry => entry.feature === feature)!.cells[0]
    expect(row('Scheduled checks')).toEqual({ kind: 'text', value: 'Any schedule' })
    expect(row('Check after every deploy')).toEqual({ kind: 'yes' })
    expect(PRICING_PAGE_FAQ.find(entry => entry.question.includes('every deploy'))!.answer).toMatch(/included on Free during open beta/)
    expect(JSON.stringify(PRICING_TIERS[0])).not.toMatch(/weekly/i)
  })

  it('does not imply unlimited websites or immediate paid access', () => {
    const surface = JSON.stringify({ PLANS, PRICING, PRICING_TIERS, PRICING_PAGE_FAQ })
    expect(surface).not.toMatch(/unlimited (Sites|websites)|verified weekly|24\/7/i)
    expect(surface).toMatch(/no automatic charge/i)
    expect(PRICING_PAGE_FAQ.every(entry => entry.learnMore?.href && entry.learnMore.label)).toBe(true)
  })
})

describe('Terms of Service', () => {
  it('is dated for the per-account pricing change', () => {
    expect(LEGAL_PAGE_META.termsUpdated).toBe('November 11, 2026')
  })

  it('states customer responsibility and limits FixFlags liability', () => {
    expect(TERMS_SECTIONS.acceptableUse.body).toMatch(/Only check websites you own or are authorized to check/)
    expect(TERMS_SECTIONS.responsibility.body).toMatch(/You are responsible for how you use FixFlags and for every change you make/)
    expect(TERMS_SECTIONS.responsibility.body).toMatch(/AI tool/)
    expect(TERMS_SECTIONS.liability.body).toMatch(/not responsible for how you or anyone else uses the service, or for the results of applying/)
    expect(TERMS_SECTIONS.liability.body).toMatch(/total liability/)
    expect(termsText).not.toMatch(/\u2014/)
  })

  it('preserves existing waitlist discount commitments', () => {
    expect(TERMS_SECTIONS.discountTiers.body).toMatch(/first 500 waitlisters per plan receive 25% off/)
    expect(TERMS_SECTIONS.discountTiers.body).toMatch(/next 500 waitlisters per plan receive 15% off/)
    expect(TERMS_SECTIONS.discountTiers.body).toMatch(/twelve months/)
  })
})
