import { describe, expect, it } from 'vitest'
import { CARE_HOME, SEO } from '@/lib/marketing/copy-barrel'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { REVIEW_ENTRY } from '@/lib/marketing/copy/terminology'
import { BRAND, SOCIAL_CARD } from '@/lib/marketing/copy/brand'
import { PRODUCT_STORY } from '@/lib/marketing/copy/product-story'

/** Rendered narrative coverage lives in PublicPages and CareHomepage component tests. */
describe('shared product story contracts', () => {
  it('uses the same three responsibilities in the homepage and public explanation', () => {
    const expected = ['monitor', 'flag', 'fix']
    expect(CARE_HOME.workflow.steps.map(step => step.id)).toEqual(expected)
    expect(PUBLIC_SITE_COPY.howItWorks.steps.map(step => step.id)).toEqual(expected)
    expect(CARE_HOME.workflow.steps[2].body).toContain('Check now')
    expect(CARE_HOME.workflow.steps[0].body).toMatch(/save your site to start scheduled monitoring/i)
    expect(SEO.home.description).toBe(PRODUCT_STORY.description)
    expect(SEO.home.description).toMatch(/email alerts/i)
    expect(SEO.home.description).toMatch(/clear steps to fix/i)
  })
  it('keeps the hero and social artwork on the same product promise', () => {
    expect(CARE_HOME.hero.headline.join(' ')).toBe(BRAND.tagline)
    expect(SOCIAL_CARD.headline.join(' ')).toBe(BRAND.tagline)
  })
  it('keeps the first analysis and public evidence destinations reachable before signup', () => {
    expect(REVIEW_ENTRY.href).toBe('/new')
    expect(PUBLIC_SITE_COPY.sample).toBe('Explore the product sample')
  })
})
