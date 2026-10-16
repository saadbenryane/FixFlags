import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { runMessagingClarityChecks } from './messaging-clarity'
import { isCustomerFlag } from '../attention'

describe('messaging context and certainty', () => {
  it('uses the observed supporting introduction rather than requiring the audience in the headline', () => {
    const meta = parseMetadataFromHtml('<h1>The platform</h1><p>Plan releases for engineering teams.</p>', 'https://example.com/')
    expect(runMessagingClarityChecks(meta).map(flag => flag.checkId)).toContain('messaging-weak-value-prop')
    const observed = { ...meta, renderedCopy: { version: 1 as const, pageUrl: 'https://example.com/',
      h1s: ['The platform'], h2s: [], pageText: meta.pageText, headlineSupport: 'Plan releases for engineering teams.', complete: true, textTruncated: false } }
    expect(runMessagingClarityChecks(observed).map(flag => flag.checkId)).not.toContain('messaging-weak-value-prop')
    expect(runMessagingClarityChecks(observed).map(flag => flag.checkId)).not.toContain('messaging-no-audience')
  })

  it('does not measure concatenated navigation and card labels as prose sentences', () => {
    const labels = 'Navigation Menu Platform Solutions Resources Open Source Enterprise Pricing Sign in Sign up '.repeat(8)
    const meta = parseMetadataFromHtml('<h1>Build websites for teams</h1>', 'https://example.com/')
    const observed = { ...meta, renderedCopy: { version: 1 as const, pageUrl: 'https://example.com/', h1s: ['Build websites for teams'], h2s: [], pageText: labels, proseBlocks: ['Build and publish your next website.'], complete: true, textTruncated: false } }
    expect(runMessagingClarityChecks(observed).map(flag => flag.checkId)).not.toContain('messaging-long-sentences')
    const long = 'Our experienced product team works together to build and publish useful websites for growing companies while carefully checking every important step that people take when they visit the website and try to find the information that they need before starting their next project'
    expect(runMessagingClarityChecks({ ...observed, renderedCopy: { ...observed.renderedCopy, proseBlocks: [long + '.', long + '.', long + '.'] } }).map(flag => flag.checkId)).toContain('messaging-long-sentences')
  })

  it('retains wording observations as recommendations without erasing their recorded severity', () => {
    for (const checkId of ['messaging-weak-value-prop', 'messaging-jargon-overload', 'messaging-no-audience', 'friction-form-too-many-fields', 'trust-unsupported-claims', 'hierarchy-competing-actions']) {
      expect(isCustomerFlag({ checkId, severity: 'IMPORTANT', confidence: 1, impactTag: 'CONVERSION' })).toBe(false)
    }
    expect(isCustomerFlag({ checkId: null, rubric: 'MESSAGE', severity: 'CRITICAL', confidence: 1 })).toBe(false)
    expect(isCustomerFlag({ checkId: 'form-contact-submit-failed', severity: 'IMPORTANT', confidence: 1, impactTag: 'CONVERSION' })).toBe(true)
  })
})
