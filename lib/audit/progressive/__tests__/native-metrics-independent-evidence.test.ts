import { describe, expect, it } from 'vitest'
import { evaluatorHandlers } from '../evaluators'
import { serializeArtifact, readArtifact } from '../contracts'
import { checkArtifactSchema } from '../results'
import type { TaskContext } from '../registry'
import type { RenderedCopy } from '../../browser/rendered-copy'
import type { CaptureMetrics } from '../../capture-metrics'
import { CHECK_REGISTRY } from '../../check-registry'
import { scopedAssertionForTarget } from '../../checks/verification'

const pageUrl = 'https://example.com/'
const scope = { pageUrl, finalUrl: pageUrl, profile: 'desktop', access: 'public' }
const mobile = { ...scope, profile: 'mobile' }
const inputContext = 'mobile-input:' + '1'.repeat(64)
const evaluate = evaluatorHandlers.find(handler => handler.kind === 'check')!.evaluate
const checks = { 'mobile-ux-quality': 'mobile-input-zoom', 'cta-focus': 'competing-ctas',
  'visual-polish': 'visual-radius-inconsistent', 'visual-hierarchy': 'hierarchy-competing-actions', layout: 'cta-below-fold-mobile', metadata: 'title-missing', 'og-image': 'og-image-broken' }
function metrics(repaired = false): CaptureMetrics {
  return { mobilePrimaryCtaTopPx: 900, mobilePrimaryCtaText: 'Get started', competingPrimaryCtaCount: 3,
    competingPrimaryCtaLabels: ['Get started', 'Request demo', 'Pricing'], competingPrimaryCtaComplete: true,
    mobileViewportHeight: 800, mobileScrollY: 0, mobileDocumentHeight: 1600,
    stuckLoadingIndicator: false, stuckLoadingLabel: null, uniqueFontFamilies: 4, fontFamilySample: ['Arial', 'Times', 'Verdana', 'Georgia'],
    buttonBorderRadii: [0, 8, 16], buttonBorderRadiiComplete: true, motionIgnoresReducedPreference: false, motionSampleLabel: null,
    inputsBelow16px: repaired ? [] : [{ selector: '#email', fontSize: 12 }],
    inputFontSamples: [{ selector: '#email', fontSize: repaired ? 16 : 12, context: inputContext }], inputFontsComplete: true,
    loadingObservation: { version: 1, device: 'mobile', scope: mobile, contentVisible: true, ready: true, restricted: false } }
}
async function observed(module: keyof typeof checks, repaired = false, renderedCopy?: RenderedCopy,
  head?: Record<string, unknown>) {
  const context = { audit: { id: 'after', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
    environment: 'production', scope: 'SITE', checks: { [checks[module]]: CHECK_REGISTRY[checks[module]].version }, outcomes: [], verificationTarget: null } },
    task: { id: 'check' }, input: { pageUrl, position: 0, primary: true, role: 'primary', module }, deadline: Date.now() + 10_000,
    dependencies: new Map([['browser', { workKind: 'browser', workState: 'COMPLETED', workResult: serializeArtifact('browser', {
      pageId: 'page', metadata: null, snapshot: { desktopUrl: null, mobileUrl: null, desktopHtml: null, desktopHtmlTruncated: true,
        desktopFinalUrl: pageUrl, desktopBase64: null, mobileBase64: null, consoleErrors: [], captureFailures: [],
        captureStatus: { desktop: 'ok', mobile: 'ok' }, renderedScope: scope, captureMetrics: metrics(repaired), ...(renderedCopy ? { renderedCopy } : {}),
        ...(head ? { runtimeHeadMetadata: head, runtimeHeadScope: scope } : {}) },
    }) }]]),
  } as unknown as TaskContext
  return checkArtifactSchema.parse(readArtifact(await evaluate(context), 'check').data)
}
describe('independent native metric evaluation', () => {
  it('retains native head observations when whole-document parsing is unavailable', async () => {
    const head = { title: null, description: null, ogTitle: null, ogDescription: null, ogImage: null,
      viewport: null, lang: null, canonical: null, robots: null, hasFavicon: false }
    const failure = await observed('metadata', false, undefined, head)
    expect(failure.flags.map(flag => flag.checkId)).toEqual(expect.arrayContaining([
      'og-image-missing', 'og-title-missing', 'og-description-missing', 'favicon-missing', 'viewport-missing', 'lang-missing',
    ]))
    expect(failure.receipt.passed).toBe(false)
    expect(failure.receipt.assertions.every(assertion => assertion.complete === true)).toBe(true)
    const repair = await observed('metadata', false, undefined, { ...head, title: 'Useful project reports',
      description: 'Prepare useful reports for every project with a clear record of the results.',
      ogTitle: 'Useful reports', ogDescription: 'A clear project record', ogImage: 'https://example.com/preview.png',
      hasFavicon: true, viewport: 'width=device-width', lang: 'en', canonical: pageUrl })
    expect(repair.receipt.passed).toBe(true)
    expect(repair.receipt.assertions.every(assertion => assertion.complete === true)).toBe(true)
    for (const flag of failure.flags) if (flag.evidenceTargets?.length) {
      const result = scopedAssertionForTarget({ receipt: repair.receipt, checkId: flag.checkId, flag })
      expect(result?.assertion).toMatchObject({ complete: true, passed: true })
    }
  })

  it('keeps missing and oversized native fields unknown alongside independent observations', async () => {
    const result = await observed('metadata', false, undefined, { title: 'x'.repeat(9000), hasFavicon: false })
    expect(result.flags.map(flag => flag.checkId)).toEqual(['favicon-missing'])
    expect(result.receipt.assertions.find(assertion => assertion.key === 'title-presence')).toMatchObject({ complete: false, passed: false })
    expect(result.receipt.assertions.find(assertion => assertion.key === 'favicon-presence')).toMatchObject({ complete: true, passed: false })
    expect(result.receipt.complete).toBe(false)
  })

  it('keeps an unavailable native image declaration unknown without inventing a destination', async () => {
    const result = await observed('og-image', false, undefined, {})
    expect(result.flags).toEqual([])
    expect(result.receipt).toMatchObject({ complete: false, passed: false })
    expect(result.receipt.assertions).toEqual([expect.objectContaining({ key: 'preview-image-response', complete: false, passed: false })])
  })

  it('does not guess the document base of an older relative image observation', async () => {
    const result = await observed('og-image', false, undefined, { ogImage: 'preview.png' })
    expect(result.flags).toEqual([])
    expect(result.receipt).toMatchObject({ complete: false, passed: false })
  })

  it.each(['mobile-ux-quality', 'cta-focus', 'visual-polish', 'visual-hierarchy'] as const)('retains %s findings without inventing full metadata', async module => {
    const before = await observed(module)
    expect(before.flags.map(flag => flag.checkId)).toContain(checks[module])
    if (module === 'visual-hierarchy') {
      expect(before.flags.map(flag => flag.checkId)).not.toContain('hierarchy-no-headline')
      expect(before.receipt.assertions.find(assertion => assertion.key === 'headline-presence')).toMatchObject({ passed: false, complete: false })
    }
  })
  it('uses independently retained prose while leaving incomplete prose separate from native action style', async () => {
    const copy: RenderedCopy = { version: 1, pageUrl, pageText: 'Useful service information. '.repeat(12), h1s: ['Build useful reports'],
      h2s: ['How it works'], complete: true, textTruncated: false }
    const complete = await observed('visual-hierarchy', false, copy)
    expect(complete.receipt.assertions.find(assertion => assertion.key === 'headline-presence')).toMatchObject({ passed: true, complete: true })
    const incomplete = await observed('visual-hierarchy', false, { ...copy, complete: false })
    expect(incomplete.flags.map(flag => flag.checkId)).toContain('hierarchy-competing-actions')
    expect(incomplete.receipt.assertions.find(assertion => assertion.key === 'headline-presence')).toMatchObject({ passed: false, complete: false })
    expect(incomplete.receipt.complete).toBe(false)
  })
  it('independently verifies the same input cohort while page purpose and HTML remain unavailable', async () => {
    const before = await observed('mobile-ux-quality'), flag = before.flags.find(flag => flag.checkId === 'mobile-input-zoom')!
    const after = await observed('mobile-ux-quality', true)
    expect(scopedAssertionForTarget({ receipt: after.receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ complete: true, passed: true })
    expect(after.receipt.assertions.filter(assertion => ['mobile-cta-position', 'mobile-cta-label'].includes(assertion.key)))
      .toEqual([expect.objectContaining({ complete: false, passed: false }), expect.objectContaining({ complete: false, passed: false })])
  })
  it('does not infer conversion purpose or replace missing HTML with an empty document', async () => {
    const unknown = await observed('layout')
    expect(unknown.flags).toEqual([])
    expect(unknown.receipt).toMatchObject({ passed: false, complete: false })
    expect(unknown.receipt.assertions).toEqual([expect.objectContaining({ complete: false, passed: false })])
    await expect(observed('metadata')).rejects.toMatchObject({ code: 'PAGE_EVIDENCE_UNAVAILABLE' })
  })
})
