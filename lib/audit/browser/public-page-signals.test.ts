// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import type { Page } from 'playwright'
import { capturedPublicPageSignals, readPublicPageSignals } from './public-page-signals'
import { publicTrustObservations, runTrustChecks } from '../checks/trust'
import { runAllChecks } from '../checks'
import { scopedAssertionForTarget } from '../checks/verification'

const page = { url: () => location.href, evaluate: async (fn: (args: unknown) => unknown, args: unknown) => fn(args) } as unknown as Page
const scope = () => ({ pageUrl: location.href, finalUrl: location.href, profile: 'native-desktop', access: 'public' })
const copy = (consent: boolean) => ({ version: 1 as const, pageUrl: location.href, pageText: '', h1s: [], h2s: [], complete: false, textTruncated: true,
  consentControls: consent ? [{ name: 'Cookie settings', context: 'Cookie settings' }] : [], consentControlsComplete: true })
beforeEach(() => { document.documentElement.innerHTML = '<head></head><body></body>' })

describe('shared native public-page signals', () => {
  it('reads trust declarations without claiming an analytics observation', async () => {
    document.head.innerHTML = '<script>gtag("config","PRIVATE_PROJECT")</script>'
    document.body.innerHTML = '<a href="/privacy">Privacy</a><a href="mailto:help@example.com">Contact</a>'
    expect(await readPublicPageSignals(page, 'trust')).toMatchObject({ hasPrivacyPolicy: true, hasContactInfo: true,
      hasAnalytics: null, hasCookieBasedAnalytics: null })
  })
  it('observes analytics markup without a whole-page parse or unrelated trust collection', async () => {
    document.head.innerHTML = '<script type="application/json">{"provider":"plausible","key":"PRIVATE_PROJECT"}</script>'
    document.body.innerHTML = '<p>A useful public page</p>'
    const signals = await readPublicPageSignals(page, 'analytics')
    expect(signals).toMatchObject({ hasAnalytics: true, hasCookieBasedAnalytics: false, hasPrivacyPolicy: null, hasContactInfo: null })
    expect(JSON.stringify(signals)).not.toContain('PRIVATE_PROJECT')
  })
  it('detects and independently verifies native markup without borrowing provider recording', async () => {
    document.body.innerHTML = '<p>A useful public page</p>'
    const tracking = { version: 1 as const, phase: 'page_load' as const, requests: [], truncated: false, durationMs: 100, consentInteraction: 'none' as const }
    async function checked() {
      const signals = { ...(await readPublicPageSignals(page))!, scope: scope() }
      return runAllChecks(location.href, null, null, null, [], undefined, null, null, undefined, true, ['measurement'], {
        publicTrustSignals: signals, publicTrustScope: scope(), tracking,
      })
    }
    const before = await checked()
    expect(before.flags).toMatchObject([{ checkId: 'measurement-ga-gtm-posthog-missing' }])
    document.head.innerHTML = '<script type="application/json">{"provider":"plausible"}</script>'
    const after = await checked()
    expect(after.flags).toEqual([])
    expect(after.executions[0].assertions?.find(assertion => assertion.key === 'analytics-markup')).toMatchObject({ passed: true, complete: true })
    expect(after.executions[0].assertions?.find(assertion => assertion.key === 'tracking-provider-recording')).toMatchObject({ passed: false, complete: false })
    const receipt = { kind: 'site-module-check' as const, version: 1 as const, ...after.executions[0], pageUrl: location.href,
      execution: { auditId: 'independent', taskId: 'native-markup', checkVersion: 1, source: 'browser-network' as const, collectedAt: new Date().toISOString() } }
    expect(scopedAssertionForTarget({ receipt, checkId: before.flags[0].checkId, flag: before.flags[0] })?.assertion).toMatchObject({ complete: true, passed: true })
  })
  it('retains observed signals after the whole document exceeds its separate bound', async () => {
    document.head.innerHTML = '<script>gtag("config","PRIVATE_PROJECT_KEY")</script>'
    document.body.innerHTML = '<p>' + 'x'.repeat(1_100_000) + '</p><a href="/privacy">Privacy</a><a href="mailto:help@example.com">Email us</a>'
    const signals = await readPublicPageSignals(page)
    expect(signals).toMatchObject({ hasPrivacyPolicy: true, hasContactInfo: true, hasCookieBasedAnalytics: true })
    expect(JSON.stringify(signals)).not.toContain('PRIVATE_PROJECT_KEY')
    expect(runTrustChecks(location.href, null, signals, copy(false)).map(flag => flag.checkId)).toEqual(['cookie-consent-absent'])
    expect(runTrustChecks(location.href, null, signals, copy(true))).toEqual([])
  })
  it('keeps uninspected contact text and analytics unknown without discarding an observed missing privacy link', async () => {
    document.body.innerHTML = '<p>' + 'x'.repeat(1_100_000) + '</p>'
    const signals = await readPublicPageSignals(page)
    expect(signals).toMatchObject({ hasAnalytics: null, hasPrivacyPolicy: false, hasContactInfo: null, hasCookieBasedAnalytics: null })
    const observations = publicTrustObservations(null, signals, copy(false))
    expect(observations['privacy-link']).toMatchObject({ passed: false, complete: true })
    expect(observations['contact-information']).toMatchObject({ passed: false, complete: false })
    expect(observations['cookie-consent-signals']).toMatchObject({ passed: false, complete: false })
    expect(publicTrustObservations(null, signals, copy(true))['cookie-consent-signals']).toMatchObject({ passed: true, complete: true,
      observed: expect.stringContaining('analytics markup') })
    expect(runTrustChecks(location.href, null, signals, copy(false)).map(flag => flag.checkId)).toEqual(['no-privacy-policy'])
  })
  it('excludes unpublished contact details and dormant privacy links', async () => {
    document.body.innerHTML = '<template><a href="/privacy">Privacy</a>Contact template@example.com</template>' +
      '<script>const contact="internal@example.com"</script><style>@font-face{font-family:Contact}</style><div hidden>Email hidden@example.com</div>'
    expect(await readPublicPageSignals(page)).toMatchObject({ hasPrivacyPolicy: false, hasContactInfo: false })
  })
  it('observes root declarations while leaving uninspected template analytics unknown', async () => {
    document.documentElement.setAttribute('data-tracking', 'googletagmanager')
    expect(await readPublicPageSignals(page)).toMatchObject({ hasCookieBasedAnalytics: true })
    document.documentElement.removeAttribute('data-tracking')
    document.body.innerHTML = '<template><script>gtag("config","PRIVATE_TEMPLATE_KEY")</script></template>'
    expect(await readPublicPageSignals(page)).toMatchObject({ hasCookieBasedAnalytics: null })
  })
  it('binds repair to the actual native capture and independently observed consent controls', async () => {
    document.head.innerHTML = '<script>gtag("config","PRIVATE_PROJECT_KEY")</script>'
    document.body.innerHTML = '<a href="/privacy">Privacy</a><a href="/contact">Contact</a>'
    const signals = { ...(await readPublicPageSignals(page))!, scope: scope() }
    const capture = { publicTrustSignals: signals, renderedCopy: copy(true), renderedCopyScope: scope() }
    const native = capturedPublicPageSignals(capture)
    const original = (await runAllChecks(location.href, null, null, null, [], undefined, null, null, undefined, true, ['trust'], {
      publicTrustSignals: signals, publicTrustCopy: copy(false), publicTrustScope: scope(),
    })).flags[0]
    const repaired = await runAllChecks(location.href, null, null, null, [], undefined, null, null, undefined, true, ['trust'], {
      publicTrustSignals: native.signals, publicTrustCopy: native.copy, publicTrustScope: native.scope,
    })
    expect(repaired.flags).toEqual([])
    expect(repaired.executions[0]).toMatchObject({ complete: true, passed: true })
    const receipt = { kind: 'site-module-check' as const, version: 1 as const, ...repaired.executions[0], pageUrl: location.href,
      execution: { auditId: 'independent', taskId: 'native-trust', checkVersion: 1, source: 'rendered-dom' as const, collectedAt: signals.collectedAt } }
    expect(scopedAssertionForTarget({ receipt, checkId: 'cookie-consent-absent', flag: original })?.assertion).toMatchObject({ passed: true, complete: true })
    for (const gap of [{ desktopHttpStatus: 503 }, { desktopFinalUrl: 'https://other.example/' }, { collectionRestrictions: ['read_only_refusal'] }])
      expect(capturedPublicPageSignals({ ...capture, ...gap }).signals).toBeNull()
    const changed = capturedPublicPageSignals({ ...capture, renderedCopyScope: { ...scope(), profile: 'other-browser' } })
    expect(changed.copy).toBeNull()
    expect(publicTrustObservations(null, changed.signals, changed.copy)['cookie-consent-signals']).toMatchObject({ passed: false, complete: false })
  })
})
