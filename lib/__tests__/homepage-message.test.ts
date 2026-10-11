import { describe, expect, it } from 'vitest'
import { CARE_HOME, SEO } from '@/lib/marketing/copy'
import { PUBLIC_SITE_COPY } from '@/lib/marketing/copy/public-site'
import { REVIEW_ENTRY } from '@/lib/marketing/copy/terminology'

/** Rendered narrative coverage lives in PublicPages and CareHomepage component tests. */
describe('shared product story contracts', () => {
  it('uses the same three responsibilities in the homepage and public explanation', () => {
    const expected = ['monitor', 'flag', 'fix']
    expect(CARE_HOME.workflow.steps.map(step => step.id)).toEqual(expected)
    expect(PUBLIC_SITE_COPY.howItWorks.steps.map(step => step.id)).toEqual(expected)
    expect(PUBLIC_SITE_COPY.howItWorks.title).toBe('Monitor. Flag. Fix. Repeat.')
    expect(CARE_HOME.workflow.steps[2].body).toContain('Check now')
    expect(SEO.home.description).toContain('checks again after you publish a fix')
  })
  it('keeps the first analysis and public evidence destinations reachable before signup', () => {
    expect(REVIEW_ENTRY.href).toBe('/new')
    expect(PUBLIC_SITE_COPY.sample).toBe('Explore the product sample')
  })
})
