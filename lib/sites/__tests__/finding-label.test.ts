import { describe, expect, it } from 'vitest'
import { customerFindingLabel, customerFindingExplanation } from '../finding-label'
import { isRetiredFlagExplanation } from '../retired-flag-explanations'
import { FLAG_EXPLANATIONS, FLAG_EXPLANATION_FALLBACK } from '@/lib/marketing/copy/flag-explanations'
import { FINDING_LABEL_COPY } from '@/lib/marketing/copy/finding-labels'

describe('plain-language finding presentation', () => {
  it('explains the photographed performance findings without exposing jargon in headlines', () => {
    const flag = { checkId: 'mobile-lcp-critical::page:abc', problem: 'Mobile LCP is critically slow (4.5s, target < 2.5s)' }
    expect(customerFindingLabel(flag)).toBe('Main content takes too long to appear on phones')
    expect(customerFindingLabel({ checkId: 'unoptimized-images', problem: 'Images are not optimized (40023KB savings)' })).toBe('Images take too much time to load')
    expect(flag.problem).toContain('LCP')
  })
  it('keeps unknown findings and custom explanations exact, including their scope', () => {
    expect(customerFindingLabel({ checkId: 'custom-check', problem: 'Only the second checkout step failed.' })).toBe('Only the second checkout step failed.')
    expect(customerFindingExplanation({ checkId: 'lcp-poor', whyItMatters: 'Specific recorded explanation.' })).toBe('Specific recorded explanation.')
    expect(customerFindingExplanation({ checkId: 'mobile-lcp-poor::page:abc', whyItMatters: FLAG_EXPLANATIONS['lcp-poor'] })).toContain('biggest image or block of text')
    expect(customerFindingLabel({ checkId: 'buttons-no-text', problem: 'Only the second checkout button failed.' })).toBe('Only the second checkout button failed.')
  })
  it('leaves timing and origin scope in the original evidence without reconstructing them from prose', () => {
    const label = customerFindingLabel({ checkId: 'mobile-inp-critical', problem: 'Origin-level mobile Interaction to Next Paint is critically slow (650ms, target <= 200ms)' })
    expect(label).toBe('Pages respond slowly to taps or typing on phones')
    expect(label).not.toContain('phones on phones')
    expect(customerFindingLabel({ checkId: 'lcp-poor', problem: 'No recorded timing' })).not.toMatch(/\d/)
  })

  it('states the problem instead of a task for checks that recorded a review instruction', () => {
    expect(customerFindingLabel({ checkId: 'title-too-short', problem: 'Review this brief page title (8 characters)' })).toBe('The page title is too short to describe the page')
    expect(customerFindingLabel({ checkId: 'placeholder-copy-detected', problem: 'Review a placeholder-like pattern in recorded page text' })).toBe('Text that looks like a placeholder is on the page')
    expect(customerFindingLabel({ checkId: 'friction-form-too-many-fields', problem: 'Review the 9 fields in the conversion form' })).toBe('The form asks for a lot of details')
    expect(customerFindingLabel({ checkId: 'flow-cta-404', problem: 'Primary CTA leads to an error page' })).toBe('The main button leads to an error page')
    for (const title of Object.values(FINDING_LABEL_COPY)) {
      expect(title).not.toMatch(/^(Review|Check|Confirm|Inspect|Consider|Add|Fix)\b/)
      expect(title).not.toMatch(/\b(CTA|H1|LCP|CLS|INP|og:|HTTP \d)/)
      expect(title).not.toContain('\u2014')
    }
  })

  it('names every visitor path condition once and keeps a link’s recorded wording', () => {
    expect(customerFindingLabel({ checkId: 'journey-pricing-evaluation-destination-no-headline', problem: 'Review the destination H1 and its supporting context' }))
      .toBe('The next page has no clear headline')
    expect(customerFindingLabel({ checkId: 'journey-first-visit-hidden-cta', problem: "Review the entry page's primary action" })).toBe('The first page has no clear next step')
    expect(customerFindingLabel({ checkId: 'journey-signup-nav-broken', problem: 'The link "Start free" did not open' })).toBe('The link "Start free" did not open')
  })

  it('gives each recorded condition of one check its own title', () => {
    expect(customerFindingLabel({ checkId: 'flow-form-no-validation', problem: 'Conversion form has no visible submit control' })).toBe('The form has no visible submit button')
    expect(customerFindingLabel({ checkId: 'flow-form-no-validation', problem: 'Empty form submit shows no validation feedback' })).toBe('Sending the form empty shows no message')
    expect(customerFindingLabel({ checkId: 'journey-funnel-dead-end', problem: 'No recognized substantive content at the checked destination' })).toBe('A page on the path shows no real content')
    expect(customerFindingLabel({ checkId: 'flow-form-no-validation', problem: 'Only the newsletter form failed.' })).toBe('Only the newsletter form failed.')
  })

  it('replaces accessibility engine rule text and missing-page status codes', () => {
    expect(customerFindingLabel({ checkId: 'form-inputs-no-label', problem: 'Form elements must have labels (1 element)' })).toBe('Some form fields don’t say what to enter')
    expect(customerFindingLabel({ checkId: 'buttons-no-text', problem: 'Buttons must have discernible text (2 elements)' })).toBe('Some buttons have no name for screen readers')
    expect(customerFindingLabel({ checkId: 'page-http-error', problem: 'This page returns HTTP 404' })).toBe('This page doesn’t open')
    expect(customerFindingLabel({ checkId: 'axe-target-size', problem: 'All touch targets must be 24px large, or leave sufficient space (5 elements)' })).toBe('Some buttons and links are hard to tap')
  })

  it('shows current wording for an explanation stored from a retired template', () => {
    const retired = 'Some recorded form inputs lack a recognized accessible label. Inspect their computed names and provide a suitable label for each affected field.'
    expect(isRetiredFlagExplanation(retired)).toBe(true)
    expect(customerFindingExplanation({ checkId: 'form-inputs-no-label', whyItMatters: retired })).toBe(FLAG_EXPLANATIONS['form-inputs-no-label'])
    expect(customerFindingExplanation({ checkId: 'unknown-check', whyItMatters: 'Review the recorded problem, affected scope, and evidence to decide the next action. Effects beyond this observation were not measured.' }))
      .toBe(FLAG_EXPLANATION_FALLBACK)
    for (const current of Object.values(FLAG_EXPLANATIONS)) expect(isRetiredFlagExplanation(current), current).toBe(false)
  })
})
