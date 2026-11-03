import { describe, expect, it } from 'vitest'
import { customerFindingLabel, customerFindingExplanation } from '../finding-label'
import { FLAG_EXPLANATIONS } from '@/lib/marketing/copy/flag-explanations'

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
    expect(customerFindingExplanation({ checkId: 'mobile-lcp-poor::page:abc', whyItMatters: FLAG_EXPLANATIONS['lcp-poor'] })).toContain('largest image or text block')
    expect(customerFindingLabel({ checkId: 'buttons-no-text', problem: 'Only the second checkout button failed.' })).toBe('Only the second checkout button failed.')
  })
  it('leaves timing and origin scope in the original evidence without reconstructing them from prose', () => {
    const label = customerFindingLabel({ checkId: 'mobile-inp-critical', problem: 'Origin-level mobile Interaction to Next Paint is critically slow (650ms, target <= 200ms)' })
    expect(label).toBe('Pages respond slowly to taps or typing on phones')
    expect(label).not.toContain('phones on phones')
    expect(customerFindingLabel({ checkId: 'lcp-poor', problem: 'No recorded timing' })).not.toMatch(/\d/)
  })
})
