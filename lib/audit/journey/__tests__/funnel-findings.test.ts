import { describe, expect, it } from 'vitest'
import { assessFunnelDestination } from '../funnel-findings'
import { isCustomerFlag } from '../../attention'

const facts = { currentStep: 2, currentUrl: 'https://example.com/pricing', maxSteps: 10,
  isLoading: false, hasContent: true, headlinePassed: true, primaryActionFound: true }

describe('native destination assessment', () => {
  it('does not label a short present H1 absent or prescribe an arbitrary word limit', () => {
    const finding = assessFunnelDestination({ ...facts, headlinePassed: false })[0]!
    expect(finding.evidence).toContain('12-character check')
    expect(finding.evidence).toContain('does not establish that no H1 exists')
    expect(finding.fix).toContain('nearby supporting copy')
    expect(finding.fix).not.toContain('under 12 words')
    expect(isCustomerFlag(finding)).toBe(false)
  })
  it('keeps a transient loading sample a Recommendation without diagnosing permanent loading or prescribing a timing repair', () => {
    const finding = assessFunnelDestination({ ...facts, isLoading: true, hasContent: false })[0]!
    expect(finding.evidence).toContain('Continuous loading was not measured')
    expect(finding.problem).not.toMatch(/stuck|never|timeout/i)
    expect(finding.fix).not.toMatch(/fallback|3 seconds/i)
    expect(isCustomerFlag(finding)).toBe(false)
    expect(assessFunnelDestination(facts)).toEqual([])
  })
  it('keeps missing-content evidence distinct from navigation and post-action feedback', () => {
    const findings = assessFunnelDestination({ ...facts, hasContent: false, primaryActionFound: false })
    expect(findings.map(finding => finding.conditionId)).toEqual(['missing-content', 'journey-funnel-missing-feedback'])
    expect(findings.every(finding => finding.source === 'JOURNEY')).toBe(true)
    expect(findings[1]!.evidence).toContain('Post-action feedback was not measured')
    expect(isCustomerFlag(findings[0]!)).toBe(false)
  })
})
