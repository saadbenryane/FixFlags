import { describe, expect, it } from 'vitest'
import { FAQ, PLANS, PRICING, PRICING_FAQ } from '@/lib/marketing/copy'
import { getDocsPageByPath } from '@/lib/docs/catalog'
import { INTEGRATIONS_PAGE } from '@/lib/marketing/copy/integrations'
import { OPEN_BETA_ACCESS } from '@/lib/billing/beta-policy'

/** Rendered card geometry and actions are covered by the Integrations page tests. */
describe('supported open-beta offer', () => {
  it('offers one website with paid access waitlisted', () => {
    expect(OPEN_BETA_ACCESS).toBe(true)
    expect(PRICING.headline).toMatch(/free during open beta/i)
    expect(PLANS.find(plan => plan.plan === 'FREE')?.cta).toBe('Sign up now')
    expect(PLANS.filter(plan => plan.plan !== 'FREE').every(plan => plan.href.startsWith('/waitlist'))).toBe(true)
    expect(PRICING_FAQ.some(entry => /waitlist/i.test(entry.answer))).toBe(true)
    expect(FAQ.find(entry => entry.question === 'Is FixFlags free?')?.answer).toMatch(/one website/)
  })
  it('publishes guides for supported connections and an evidence-based fix loop', () => {
    for (const path of ['/docs/integrations/shopify', '/docs/integrations/google-analytics', '/docs/integrations/google-search-console', '/docs/fix-with-ai'])
      expect(getDocsPageByPath(path), path).toBeDefined()
    expect(INTEGRATIONS_PAGE).toBeDefined()
    expect(FAQ.some(entry => /fresh|comparable/i.test(entry.answer))).toBe(true)
  })
})
