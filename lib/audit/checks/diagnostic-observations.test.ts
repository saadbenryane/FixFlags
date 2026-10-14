import { describe, expect, it } from 'vitest'
import { parseMetadataFromHtml } from '../metadata'
import type { CaptureMetrics } from '../capture-metrics'
import { PAGE_CHECKS, type PageCheckContext } from './catalog'
import { MODULE_CHECK_DEFINITIONS } from './definitions'
import type { CheckAssertion } from './assertion'
import { checkReceiptSchema } from './receipt'
import { assertionForTarget } from './verification'
import { runAllChecks } from './index'

const url = 'https://acme.fixture.test/'
const nativeLoading = { version: 1 as const, device: 'mobile' as const,
  scope: { pageUrl: url, finalUrl: url, profile: 'native-mobile', access: 'public' }, contentVisible: true, ready: true, restricted: false }
const prose = 'Our product helps developers prepare reports for their teams. Each report records the observed result clearly. Teams can review the evidence and make a useful next decision. The workflow keeps the source and its date together. '
function html(headline = 'Build useful reports for developers', body = prose.repeat(2), sections = '<h2>Features</h2><h2>Pricing</h2>', links = '<a href="/signup">Get started free</a><a href="/contact">Contact</a>') {
  return `<!doctype html><html lang="en"><head><title>Acme reports</title></head><body><main><h1>${headline}</h1>${sections}<p>${body}</p>${links}</main></body></html>`
}
function metrics(overrides: Partial<CaptureMetrics> = {}): CaptureMetrics {
  return { mobilePrimaryCtaTopPx: 250, mobilePrimaryCtaText: 'Get started free', competingPrimaryCtaCount: 1,
    competingPrimaryCtaLabels: ['Get started free'], mobileViewportHeight: 800, mobileScrollY: 0, mobileDocumentHeight: 1600,
    stuckLoadingIndicator: false, stuckLoadingLabel: null, uniqueFontFamilies: 2, fontFamilySample: ['Inter', 'Inter Tight'],
    buttonBorderRadii: [8], motionIgnoresReducedPreference: false, motionSampleLabel: null, motionComplete: true,
    inputsBelow16px: [], inputFontSamples: [{ selector: '#email', fontSize: 16 }], inputFontsComplete: true, loadingObservation: nativeLoading, ...overrides,
    ...(overrides.inputsBelow16px?.length && !overrides.inputFontSamples ? { inputFontSamples: overrides.inputsBelow16px } : {}) }
}
function loading(milliseconds: number, overrides: Partial<NonNullable<CaptureMetrics['loadExperience']>> = {}) {
  return { device: 'mobile' as const, initialScreenshotUrl: null, initialCaptureElapsedMs: 100,
    finalCaptureElapsedMs: 6000, loadingVisibleAtInitial: true, loadingVisibleAtFinal: false, loadingClearedMs: milliseconds,
    loadingLabel: 'Loading', finalReadyState: 'complete', finalTitle: 'Acme', observation: nativeLoading, ...overrides }
}
async function inspect(module: string, source = html(), captured: CaptureMetrics | null = metrics()) {
  const assertions: CheckAssertion[] = []
  const context: PageCheckContext = { url, metadata: parseMetadataFromHtml(source, url), desktop: null, mobile: null,
    consoleErrors: [], metrics: captured, purpose: { purpose: 'marketing', reasons: ['Declared controlled product fixture'] },
    scope: {}, record: assertion => assertions.push(assertion) }
  const flags = await PAGE_CHECKS.get(module)!.evaluate(context)
  const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module, pageUrl: url,
    passed: flags.length === 0, applicable: true, assertions })
  return { flags, assertions, receipt }
}
function observation(assertions: CheckAssertion[], key: string) {
  const matches = assertions.filter(assertion => assertion.key === key)
  expect(matches).toHaveLength(1)
  return matches[0]
}

describe('registered diagnostic observations', () => {
  const modules = ['content', 'slop', 'messaging-clarity', 'conversion-friction', 'trust-psychology', 'layout',
    'interaction', 'cta-focus', 'visual-polish', 'visual-hierarchy', 'mobile-ux-quality']
  it.each(modules)('%s records inspected inputs through the registered evaluator', async module => {
    const checked = await inspect(module)
    expect(checked.assertions.length).toBeGreaterThan(0)
    expect(checked.assertions.every(assertion => Boolean(MODULE_CHECK_DEFINITIONS[module].assertions[assertion.key]))).toBe(true)
    expect(checked.assertions.every(assertion => assertion.observed.length > 0 && typeof assertion.complete === 'boolean')).toBe(true)
  })

  const cases: Array<{ module: string; key: string; checkId: string; broken?: string; captured?: Partial<CaptureMetrics>; repaired?: string }> = [
    { module: 'content', key: 'headline-specificity', checkId: 'h1-generic', broken: html('Welcome to our site') },
    { module: 'content', key: 'section-headings', checkId: 'heading-hierarchy-missing', broken: html(undefined, undefined, '') },
    { module: 'slop', key: 'placeholder-patterns', checkId: 'placeholder-copy-detected', broken: html(undefined, 'Lorem ipsum ' + prose) },
    { module: 'slop', key: 'template-heading-patterns', checkId: 'template-default-copy', broken: html('Your Company Name') },
    { module: 'slop', key: 'template-tokens', checkId: 'unreplaced-template-token', broken: html(undefined, '{{ company_name }} ' + prose) },
    { module: 'slop', key: 'cta-href-values', checkId: 'cta-dead-link', broken: html(undefined, undefined, undefined, '<a href="#">Get started free</a>') },
    { module: 'messaging-clarity', key: 'headline-outcome', checkId: 'messaging-weak-value-prop', broken: html('The ultimate platform') },
    { module: 'messaging-clarity', key: 'heading-jargon', checkId: 'messaging-jargon-overload', broken: html('Empower innovation') },
    { module: 'messaging-clarity', key: 'audience-or-outcome', checkId: 'messaging-no-audience', broken: html('A brighter tomorrow') },
    { module: 'messaging-clarity', key: 'headline-length', checkId: 'messaging-headline-too-short', broken: html('Acme') },
    { module: 'trust-psychology', key: 'claim-support-signals', checkId: 'trust-unsupported-claims', broken: html('The best platform') },
    { module: 'trust-psychology', key: 'direct-contact-signals', checkId: 'trust-no-direct-contact', broken: html(undefined, undefined, undefined, '<a href="/signup">Get started free</a>') },
    { module: 'trust-psychology', key: 'internal-navigation-count', checkId: 'trust-no-internal-links', broken: html(undefined, undefined, undefined, '<a href="/signup">Get started free</a>') },
    { module: 'layout', key: 'mobile-cta-position', checkId: 'cta-below-fold-mobile', captured: { mobilePrimaryCtaTopPx: 900 } },
    { module: 'interaction', key: 'blocking-loading-ui', checkId: 'loading-indicator-stuck', captured: { stuckLoadingIndicator: true } },
    { module: 'interaction', key: 'reduced-motion', checkId: 'motion-ignores-reduced-preference', captured: { motionIgnoresReducedPreference: true } },
    { module: 'cta-focus', key: 'primary-action-count', checkId: 'competing-ctas', captured: { competingPrimaryCtaCount: 3 } },
    { module: 'visual-polish', key: 'font-family-count', checkId: 'visual-typography-sprawl', captured: { uniqueFontFamilies: 5 } },
    { module: 'visual-polish', key: 'button-radius-range', checkId: 'visual-radius-inconsistent', captured: { buttonBorderRadii: [16, 0, 8] } },
    { module: 'visual-hierarchy', key: 'prominent-action-count', checkId: 'hierarchy-competing-actions', captured: { competingPrimaryCtaCount: 2 } },
    { module: 'visual-hierarchy', key: 'section-headings', checkId: 'hierarchy-no-sections', broken: html(undefined, undefined, '') },
    { module: 'visual-hierarchy', key: 'headline-presence', checkId: 'hierarchy-no-headline', broken: html().replace(/<h1>.*?<\/h1>/, '') },
    { module: 'mobile-ux-quality', key: 'mobile-cta-position', checkId: 'mobile-cta-thumb-zone', captured: { mobilePrimaryCtaTopPx: 0 } },
    { module: 'mobile-ux-quality', key: 'mobile-cta-label', checkId: 'mobile-cta-weak-label', captured: { mobilePrimaryCtaText: 'Go' } },
  ]
  it.each(cases)('$checkId records failure and an independently evaluated changed input', async ({ module, key, checkId, broken, captured, repaired }) => {
    const before = await inspect(module, broken, metrics(captured))
    expect(before.flags.some(flag => flag.checkId === checkId)).toBe(true)
    expect(observation(before.assertions, key)).toMatchObject({ passed: false, complete: true })
    const after = await inspect(module, repaired)
    expect(observation(after.assertions, key)).toMatchObject({ passed: true, complete: true })
    if (!['reduced-motion', 'blocking-loading-ui'].includes(key)) expect(assertionForTarget(after.receipt, checkId)).toBeUndefined()
  })

  it('never upgrades an advisory positive signal into a verified business result', async () => {
    const checked = await inspect('trust-psychology', html(undefined, prose + ' Trusted by our customers.'))
    expect(observation(checked.assertions, 'authority-signals')).toMatchObject({ passed: true, disposition: 'observed' })
    expect(assertionForTarget(checked.receipt, 'trust-no-authority-signals')).toBeUndefined()
    expect(checked.assertions.some(assertion => assertion.observed.includes('Authenticity was not established'))).toBe(true)
  })
  it('records computed input sizing as a bounded CSS assertion rather than an iOS behavior certificate', async () => {
    const before = await inspect('mobile-ux-quality', html(), metrics({ inputsBelow16px: [{ selector: '#email', fontSize: 14 }] }))
    const failed = before.assertions.find(assertion => assertion.key === 'mobile-input-fonts')
    expect(failed).toMatchObject({ passed: false, complete: true })
    expect(failed?.disposition).toBeUndefined()
    const after = await inspect('mobile-ux-quality', html())
    expect(assertionForTarget(after.receipt, 'mobile-input-zoom')).toMatchObject({ passed: true, complete: true })
    expect(after.assertions.find(assertion => assertion.key === 'mobile-input-fonts')?.observed).toContain('not iOS focus')
  })
  it('keeps empty content and unusable measurements incomplete', async () => {
    for (const checkModule of ['content', 'slop', 'messaging-clarity', 'visual-hierarchy']) {
      const checked = await inspect(checkModule, '<html><body></body></html>', null)
      expect(checked.assertions.filter(assertion => assertion.complete === false).length).toBeGreaterThan(0)
      expect(checked.assertions.some(assertion => assertion.passed)).toBe(false)
    }
    for (const checkModule of ['layout', 'interaction', 'cta-focus', 'visual-polish', 'mobile-ux-quality']) {
      const checked = await inspect(checkModule, html(), null)
      expect(checked.assertions.every(assertion => !assertion.passed && assertion.complete === false)).toBe(true)
    }
    const invalid = await inspect('layout', html(), metrics({ mobilePrimaryCtaTopPx: -50 }))
    expect(invalid.flags).toEqual([])
    expect(observation(invalid.assertions, 'mobile-cta-position').complete).toBe(false)
  })
  it('does not certify a missing reduced-motion comparison through runAllChecks', async () => {
    const source = html()
    const checked = await runAllChecks(url, parseMetadataFromHtml(source, url), null, null, [], undefined,
      metrics({ motionComplete: false }), undefined, undefined, false, ['interaction'])
    expect(checked.failedModules).toEqual([])
    expect(checked.executions[0]).toMatchObject({ passed: false, complete: false })
    expect(observation(checked.executions[0].assertions ?? [], 'reduced-motion')).toMatchObject({ passed: false, complete: false })
  })
  it('keeps loading windows and delayed clearing distinct from missing observations', async () => {
    const delayed = await inspect('interaction', html(), metrics({ loadExperience: loading(5000) }))
    expect(delayed.flags.map(flag => flag.checkId)).toContain('loading-state-slow')
    expect(observation(delayed.assertions, 'loading-delay')).toMatchObject({ passed: false, complete: true })
    const repaired = await inspect('interaction', html(), metrics({ loadExperience: loading(500) }))
    expect(observation(repaired.assertions, 'loading-delay')).toMatchObject({ passed: true, complete: true })
    const stuck = await inspect('interaction', html(), metrics({ loadExperience: loading(0, { loadingClearedMs: null, loadingVisibleAtFinal: true }) }))
    expect(observation(stuck.assertions, 'loading-delay')).toMatchObject({ passed: false, complete: false })
  })
})
