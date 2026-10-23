import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { runConversionFrictionChecks } from './conversion-friction'
import type { CheckAssertion } from './assertion'

const pageUrl = 'https://reports.fixture.test/'

function inspected(copy: string, action = 'Get started free') {
  const assertions: CheckAssertion[] = []
  const html = `<!doctype html><html><body><main><h1>Reports for developers</h1><p>${copy}</p><a href="/signup">${action}</a></main></body></html>`
  const flags = runConversionFrictionChecks(parseMetadataFromHtml(html, pageUrl), { purpose: 'marketing', reasons: ['Declared product fixture'] }, assertion => assertions.push(assertion))
  return { flags, assertions }
}

describe('trial commitment wording', () => {
  it('does not treat a free-start label as a trial that omitted its payment terms', () => {
    const checked = inspected('Our product helps developers prepare reports for their teams. '.repeat(12))
    expect(checked.flags.map(flag => flag.checkId)).not.toContain('friction-trial-commitment-unclear')
    expect(checked.assertions.find(assertion => assertion.key === 'trial-payment-wording')).toBeUndefined()
  })

  it('flags a stated free trial that does not say whether a card is required', () => {
    const checked = inspected('Start your free trial today and prepare reports with your team. '.repeat(8), 'Start your free trial')
    const finding = checked.flags.find(flag => flag.checkId === 'friction-trial-commitment-unclear')
    expect(finding?.problem).toMatch(/credit card/i)
    expect(finding?.evidence).toMatch(/trial/i)
    expect(checked.assertions.find(assertion => assertion.key === 'trial-payment-wording')).toMatchObject({ passed: false, complete: true, disposition: 'observed' })
  })

  it('records the same trial as stated once the payment condition is present', () => {
    const checked = inspected('Start your free trial today. No credit card required. '.repeat(8), 'Start your free trial')
    expect(checked.flags.map(flag => flag.checkId)).not.toContain('friction-trial-commitment-unclear')
    expect(checked.assertions.find(assertion => assertion.key === 'trial-payment-wording')).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
  })
})
