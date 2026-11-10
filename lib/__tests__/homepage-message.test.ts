import { describe, expect, it } from 'vitest'
import { CARE_HOME, SEO } from '@/lib/marketing/copy-barrel'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { REVIEW_ENTRY } from '@/lib/marketing/copy/terminology'
import { BRAND, SOCIAL_CARD } from '@/lib/marketing/copy/brand'
import { PRODUCT_STORY } from '@/lib/marketing/copy/product-story'
import { SIGNATURE_SEQUENCE } from '@/lib/marketing/copy/signature-sequence'
import { AI_BUILDERS_PAGE } from '@/lib/marketing/copy/ai-builders'

/** Rendered narrative coverage lives in PublicPages and CareHomepage component tests. */
describe('shared product story contracts', () => {
  it('names one loop, in one order, on every surface that shows its steps', () => {
    expect(PRODUCT_STORY.loop).toEqual(['Check', 'Flag', 'Fix', 'Verify'])
    expect(SIGNATURE_SEQUENCE.steps.map(step => step.tab)).toEqual(PRODUCT_STORY.loop)
    expect([...PUBLIC_SITE_COPY.howItWorks.steps.map(step => step.label), PUBLIC_SITE_COPY.howItWorks.repeat.label]).toEqual(PRODUCT_STORY.loop)
    expect(AI_BUILDERS_PAGE.loop.map(step => step.label)).toEqual(PRODUCT_STORY.loop)
    expect(PUBLIC_SITE_COPY.howItWorks.steps[0].body).toMatch(/save your website.*scheduled checks/i)
    expect(SEO.home.description).toBe(PRODUCT_STORY.description)
    expect(SEO.home.description).toMatch(/real browser/i)
    expect(SEO.home.description).toMatch(/hands your AI the fix/i)
    expect(SEO.home.description).toMatch(/rechecks to prove it worked/i)
    expect(SEO.home.title).toBe(`FixFlags | ${PRODUCT_STORY.summary}`)
  })
  it('keeps the hero and social artwork on the same product promise', () => {
    expect(CARE_HOME.hero.headline.join(' ')).toBe(BRAND.tagline)
    expect(SOCIAL_CARD.headline.join(' ')).toBe(BRAND.tagline)
  })
  it('keeps the first analysis and public evidence destinations reachable before signup', () => {
    expect(REVIEW_ENTRY.href).toBe('/new')
    expect(PUBLIC_SITE_COPY.sample).toBe('Try the sample')
  })
})
