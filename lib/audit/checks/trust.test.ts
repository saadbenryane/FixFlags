import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import { publicTrustObservations, runTrustChecks } from './trust'
import { runAllChecks } from './index'
import { checkReceiptSchema } from './receipt'
import { assertionForTarget } from './verification'
import { CHECK_REGISTRY } from '../check-registry'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'

const url = 'https://example.com/'
const renderedScope = { pageUrl: url, finalUrl: url, profile: 'fixture-desktop', access: 'public' }
const base = '<!doctype html><html lang="en"><head><title>Useful information</title></head><body><main><h1>Useful information</h1>'
const analytics = '<script>window.gtag=function(){};gtag("config","G-LOCAL123")</script>'
const healthy = '<a href="/privacy">Privacy policy</a><a href="mailto:help@example.com">Email support</a><div id="cookie-settings">Cookie settings</div>'
const page = (content: string) => parseMetadataFromHtml(base + content + '</main></body></html>', url)

describe('public trust observations and independent repair', () => {
  it('collects genuine failures and positive recovery from the same captured predicates', async () => {
    const broken = page(analytics), repaired = page(analytics + healthy)
    expect(runTrustChecks(url, broken).map(flag => flag.checkId)).toEqual(['no-privacy-policy', 'no-contact-info', 'cookie-consent-absent'])
    expect(runTrustChecks(url, repaired)).toEqual([])
    expect(Object.values(publicTrustObservations(broken)).map(assertion => assertion.passed)).toEqual([false, false, false])
    const original = await runAllChecks(url, broken, null, null, [], undefined, undefined, undefined, undefined, true, ['trust'], { renderedScope })
    const checked = await runAllChecks(url, repaired, null, null, [], undefined, undefined, undefined, undefined, true, ['trust'], { renderedScope })
    expect(checked.failedModules).toEqual([])
    expect(checked.executions[0].assertions?.map(assertion => assertion.passed)).toEqual([true, true, true])
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'trust', pageUrl: url,
      applicable: true, passed: true, assertions: checked.executions[0].assertions,
      execution: { auditId: 'after', taskId: 'trust-task', checkVersion: 1, source: 'rendered-dom', collectedAt: '2026-10-12T12:00:00.000Z' } })
    const spec = { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'SITE',
      checks: { 'no-privacy-policy': 1, 'no-contact-info': 1, 'cookie-consent-absent': 1 }, outcomes: [], verificationTarget: null }
    for (const checkId of ['no-privacy-policy', 'no-contact-info', 'cookie-consent-absent']) {
      expect(assertionForTarget(receipt, checkId)?.passed).toBe(true)
      const currentSpec = { ...spec, checks: { ...spec.checks, [checkId]: CHECK_REGISTRY[checkId].version } }
      const currentReceipt = { ...receipt, execution: { ...receipt.execution, checkVersion: 2, checkVersions: { [checkId]: CHECK_REGISTRY[checkId].version } } }
      const input = { auditId: 'after', executionSpec: currentSpec, flag: { ...original.flags.find(flag => flag.checkId === checkId)!, pageUrl: url },
        executions: [{ targetKey: 'module:trust', status: 'COMPLETED', detail: currentReceipt }] }
      expect(hasRecordedRecoveryEvidence(input)).toBe(true)
      expect(hasRecordedRecoveryEvidence({ ...input, flag: { checkId, pageUrl: url + 'other' } })).toBe(false)
      expect(hasRecordedRecoveryEvidence({ ...input, executions: [{ ...input.executions[0], detail: { ...receipt, assertions: [] } }] })).toBe(false)
    }
    expect(assertionForTarget(receipt, 'console-errors-critical')).toBeUndefined()
  })
  it('keeps independent contact recovery separate from missing privacy and consent signals', () => {
    const metadata = page(analytics + '<a href="/contact">Contact us</a>')
    expect(runTrustChecks(url, metadata).map(flag => flag.checkId)).toEqual(['no-privacy-policy', 'cookie-consent-absent'])
    expect(Object.values(publicTrustObservations(metadata)).map(assertion => assertion.passed)).toEqual([false, true, false])
  })
  it('records the conditional analytics scope without asserting consent enforcement or legal compliance', () => {
    const withoutAnalytics = publicTrustObservations(page(''))['cookie-consent-signals']
    expect(withoutAnalytics.passed).toBe(true)
    expect(withoutAnalytics.disposition).toBe('observed')
    expect(withoutAnalytics.observed).toContain('consent obligations were not evaluated')
    const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'trust', pageUrl: url,
      applicable: true, passed: true, assertions: [withoutAnalytics] })
    expect(assertionForTarget(receipt, 'cookie-consent-absent')).toBeUndefined()
    const withConsent = publicTrustObservations(page(analytics + healthy))['cookie-consent-signals']
    expect(withConsent.observed).toContain('consent enforcement was not evaluated')
  })
  it('does not certify contact information from implementation code, CSS or unpublished template content', () => {
    const metadata = page('<style>@font-face{font-family:Contact;src:url(font.woff)}</style><script>const contact="internal@example.com"</script>' +
      '<template>Contact template@example.com</template><div hidden>Contact hidden@example.com</div>')
    expect(metadata.hasContactInfo).toBe(false)
    expect(publicTrustObservations(metadata)['contact-information'].passed).toBe(false)
    expect(runTrustChecks(url, metadata).map(flag => flag.checkId)).toContain('no-contact-info')
  })
  it.each([
    '<p>Email support@example.com</p>', '<p>Call 212-555-0123</p>', '<a href="mailto:help@example.com">Email us</a>',
    '<a href="tel:+12125550123">Call us</a>', '<a href="/contact">Help</a>',
    '<script type="application/ld+json">{"@type":"Organization","contactPoint":{"email":"support@example.com"}}</script>',
  ])('preserves existing published contact evidence: %s', content => {
    expect(page(content).hasContactInfo).toBe(true)
  })
})
