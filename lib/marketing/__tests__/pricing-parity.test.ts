import { describe, it, expect } from 'vitest'
import { PRICING_COPY } from '@/lib/marketing/copy/terminology'
import { PLAN_DEFINITIONS, LEGACY_PRICE_ALLOWANCES } from '@/lib/billing/plans'
import { PLANNED_PAID_PRICING } from '@/lib/billing/beta-policy'
import { PLANS, PRICING, PRICING_CARDS, PRICING_COMPARISON, PRICING_FAQ } from '@/lib/marketing/copy/plans'
import { AUTH } from '@/lib/marketing/copy/auth'
import { SEO } from '@/lib/marketing/copy/seo'
import { TERMS_SECTIONS } from '@/lib/marketing/copy/legal'

describe('open beta pricing parity', () => {
  it('shows three cards with Free available and highlighted', () => {
    expect(PRICING_CARDS.map(plan => plan.plan)).toEqual(['FREE', 'BUILDER', 'TEAM'])
    expect(PLANS[0]).toMatchObject({ price: '$0', products: '1 website', highlight: true, cta: 'Start free', href: '/sign-up' })
    for (const plan of PLANS.slice(1)) expect(plan).toMatchObject({ badge: 'Coming soon', priceLabel: 'Planned pricing', highlight: false })
  })
  it('uses planned paid prices without rewriting purchased allowances', () => {
    expect(PLANS[1].price).toBe(PLANNED_PAID_PRICING.BUILDER.price)
    expect(PLANS[2].price).toBe(PLANNED_PAID_PRICING.TEAM.price)
    expect(PRICING_COPY.studioPrice).toBe('$99')
    expect(PLAN_DEFINITIONS.TEAM.price).toBe('Volume')
    expect(LEGACY_PRICE_ALLOWANCES.BUILDER.auditLimit).toBe(25)
    expect(LEGACY_PRICE_ALLOWANCES.TEAM.auditLimit).toBe(80)
  })
  it('makes temporary full access and one website consistent across entry surfaces', () => {
    for (const surface of [JSON.stringify(PLANS[0]), PRICING.subhead, AUTH.signUp.subtitle, SEO.pricing.description, TERMS_SECTIONS.accountsAndBilling.body]) {
      expect(surface).toMatch(/beta/i)
      expect(surface).toMatch(/one website|1 website/i)
      expect(surface).toMatch(/no usage limits|without usage limits|no plan-based usage quotas/i)
    }
    expect(PRICING_FAQ.find(faq => faq.question === 'What happens when beta ends?')?.answer).toMatch(/useful Free plan/)
  })
  it('offers one monthly website-check allowance while keeping uptime separate', () => {
    const checks = PRICING_COMPARISON.rows.find(row => row.id === 'checks')!
    const uptime = PRICING_COMPARISON.rows.find(row => row.id === 'uptime')!
    const scheduling = PRICING_COMPARISON.rows.find(row => row.id === 'scheduling')!
    expect(PLANNED_PAID_PRICING.BUILDER.websiteChecks).toBe(30)
    expect(PLANNED_PAID_PRICING.TEAM.websiteChecks).toBe(PLANNED_PAID_PRICING.BUILDER.websiteChecks * 3)
    expect(checks.pro.value).toBe('30 / month')
    expect(checks.studio.value).toBe('90 / month')
    expect(checks.free.kind).toBe('unlimited')
    for (const key of ['free', 'pro', 'studio'] as const) expect(uptime[key].kind).toBe('included')
    expect(scheduling.pro.value).toBe('Custom')
    expect(scheduling.studio.value).toBe('Custom')
    expect(PRICING_COMPARISON.allowanceNote).toMatch(/scheduled and manual/)
    expect(PRICING_COMPARISON.allowanceNote).toMatch(/Uptime checks are included separately/)
    expect(JSON.stringify({ PLANS, PRICING, PRICING_COMPARISON, PRICING_FAQ })).not.toMatch(/browser verification|daily checks/i)
    expect(PLANS[2].href).toBe('/waitlist/studio')
    expect(PLANS[1].href).toBe('/waitlist/pro')
  })
  it('marks update-triggered checks as planned and integration-dependent', () => {
    const updates = PRICING_COMPARISON.rows.find(row => row.id === 'updates')!
    expect(updates.studio.value).toBe('Planned')
    expect(updates.studio.note).toMatch(/connected integration/)
    expect(updates.pro.kind).toBe('excluded')
    expect(updates.free.value).toBe('Planned')
    const answer = PRICING_FAQ.find(entry => entry.question.includes('GitHub'))!.answer
    expect(answer).toMatch(/published changes/)
    expect(answer).toMatch(/same 90-check allowance/)
    expect(answer).toMatch(/not available yet/)
  })
  it('does not imply unlimited websites or immediate paid access', () => {
    const surface = JSON.stringify({ PLANS, PRICING, PRICING_COMPARISON, PRICING_FAQ })
    expect(surface).not.toMatch(/unlimited (Sites|websites)|verified weekly|quoted per website|24\/7/i)
    expect(surface).toMatch(/no automatic charge/i)
    expect(PRICING_FAQ.every(entry => entry.learnMore?.href && entry.learnMore.label)).toBe(true)
  })
  it('preserves existing waitlist discount commitments', () => {
    expect(TERMS_SECTIONS.discountTiers.body).toMatch(/first 500 waitlisters per plan receive 25% off/)
    expect(TERMS_SECTIONS.discountTiers.body).toMatch(/next 500 waitlisters per plan receive 15% off/)
    expect(TERMS_SECTIONS.discountTiers.body).toMatch(/twelve months/)
  })
})
