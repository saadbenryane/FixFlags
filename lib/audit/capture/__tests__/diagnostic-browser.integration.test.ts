import type { Browser, BrowserContext, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { measureMobileLayout, measureMotionA11y } from '../../capture-metrics'
import { runInteractionChecks } from '../../checks/interaction'
import { runMobileUXQualityChecks } from '../../checks/mobile-ux-quality'
import { runLayoutChecks } from '../../checks/layout'
import { parseMetadataFromHtml } from '../../metadata'
import type { CheckAssertion } from '../../checks/assertion'
import { collectRenderedHtml } from '../../browser/rendered-html'
import { bindAuditPageObservation, auditPageObservation } from '../../browser/observation-scope'
import { MOBILE_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { runAllChecks } from '../../checks'
import { scopedAssertionForTarget } from '../../checks/verification'
import { checkReceiptSchema } from '../../checks/receipt'
import { hasRecordedRecoveryEvidence } from '../../recovery-evidence'

const browserTests = process.env.DIAGNOSTIC_BROWSER_REQUIRED === 'true' ? describe : describe.skip
const url = 'https://acme.fixture.test/'
browserTests('diagnostic observations from Chromium', () => {
  let browser: Browser, context: BrowserContext, page: Page
  beforeAll(async () => { browser = await getAuditBrowser() })
  afterEach(async () => { await context?.close() })
  afterAll(closeBrowser)
  async function fixture(styles: string, content: string) {
    context = await browser.newContext({ viewport: { width: 390, height: 800 } })
    page = await context.newPage()
    await page.route('**', route => route.fulfill({ contentType: 'text/html',
      body: `<!doctype html><html lang="en"><head><meta charset="utf-8"><style>${styles}</style></head><body><main><h1>Build reports for developers</h1>${content}</main></body></html>` }))
    await page.goto(url)
  }
  const animation = '.moving {width:100px;height:60px;animation:shift 2s infinite;} @keyframes shift {from{transform:translateX(0)}to{transform:translateX(10px)}}'
  it('observes ignored motion, then independently observes a repaired stylesheet and restores media preference', async () => {
    await fixture(animation, '<div class="moving">Moving content</div>')
    const before = await measureMotionA11y(page)
    expect(before).toMatchObject({ motionComplete: true, motionIgnoresReducedPreference: true })
    const first = await measureMobileLayout(page)
    expect(runInteractionChecks(first).map(flag => flag.checkId)).toContain('motion-ignores-reduced-preference')
    await page.addStyleTag({ content: '@media(prefers-reduced-motion:reduce){.moving{animation:none!important}}' })
    const after = await measureMobileLayout(page)
    const observations: CheckAssertion[] = []
    expect(runInteractionChecks(after, assertion => observations.push(assertion)).map(flag => flag.checkId)).not.toContain('motion-ignores-reduced-preference')
    expect(observations.find(assertion => assertion.key === 'reduced-motion')).toMatchObject({ passed: true, complete: true })
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion:reduce)').matches)).toBe(false)
  })
  it('records incomplete evidence if media emulation is unavailable and still restores the browser', async () => {
    await fixture(animation, '<div class="moving">Moving content</div>')
    const emulate = page.emulateMedia.bind(page)
    page.emulateMedia = async options => {
      if (options?.reducedMotion === 'reduce') throw new Error('Controlled browser emulation failure')
      return emulate(options)
    }
    const measured = await measureMobileLayout(page)
    const observations: CheckAssertion[] = []
    runInteractionChecks(measured, assertion => observations.push(assertion))
    expect(measured.motionComplete).toBe(false)
    expect(observations.find(assertion => assertion.key === 'reduced-motion')).toMatchObject({ passed: false, complete: false })
    expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion:reduce)').matches)).toBe(false)
  })
  it('inspects actual computed input fonts before and after a CSS change without claiming iOS or runtime-form proof', async () => {
    await fixture('input{font-size:12px}', '<label for="email">Email</label><input id="email" name="email" type="email"><a href="/signup">Get started free</a>')
    const before = await measureMobileLayout(page)
    expect(before.inputsBelow16px).toContainEqual({ selector: '#email', fontSize: 12 })
    expect(runMobileUXQualityChecks(before).map(flag => flag.checkId)).toContain('mobile-input-zoom')
    await page.addStyleTag({ content: 'input{font-size:16px}' })
    const after = await measureMobileLayout(page)
    const observations: CheckAssertion[] = []
    runMobileUXQualityChecks(after, 'marketing', assertion => observations.push(assertion))
    expect(observations.find(assertion => assertion.key === 'mobile-input-fonts')).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
  })
  it('measures a below-fold action and a changed placement using the actual mobile viewport', async () => {
    await fixture('main{min-height:1800px} #signup{display:block;margin-top:1000px}', '<a id="signup" href="/signup">Get started free</a>')
    const before = await measureMobileLayout(page)
    expect(before.mobilePrimaryCtaTopPx).toBeGreaterThan(800)
    expect(runLayoutChecks(before).map(flag => flag.checkId)).toContain('cta-below-fold-mobile')
    await page.addStyleTag({ content: '#signup{margin-top:100px}' })
    const after = await measureMobileLayout(page)
    const observations: CheckAssertion[] = []
    expect(runLayoutChecks(after, 'marketing', assertion => observations.push(assertion))).toEqual([])
    expect(observations[0]).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
  })
  it('compares real input sizing through an oversized document, repair and recurrence without expanding HTML limits', async () => {
    const profile = MOBILE_CAPTURE_PROFILE
    context = await browser.newContext({ viewport: { width: profile.width, height: profile.height }, userAgent: profile.userAgent,
      deviceScaleFactor: profile.deviceScaleFactor, isMobile: profile.isMobile, hasTouch: profile.hasTouch, locale: 'en-US' })
    page = await context.newPage()
    let size = 14
    let inputs = '<label for="email">Email</label><input id="email" type="email">'
    const paragraphs = `<p>${'Visible explanatory content for this controlled page. '.repeat(5)}</p>`.repeat(5000)
    await page.route('**', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>input{font-size:${size}px}</style></head><body><main><h1>Input sizing</h1>${inputs}${paragraphs}</main></body></html>` }))
    bindAuditPageObservation(page, url, profile, null, [])
    const inspect = async () => {
      await page.goto(url)
      const rendered = await collectRenderedHtml(page)
      expect(rendered.truncated).toBe(true)
      const measured = await measureMobileLayout(page, auditPageObservation(page)?.scope)
      const result = await runAllChecks(url, parseMetadataFromHtml(rendered.html ?? '', url), null, null, [], undefined, measured,
        undefined, undefined, true, ['mobile-ux-quality'])
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, ...result.executions[0], pageUrl: url,
        execution: { auditId: 'current', taskId: 'native-fonts', checkVersion: 2, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
      return { result, receipt }
    }
    const before = await inspect()
    const flag = before.result.flags.find(flag => flag.checkId === 'mobile-input-zoom')
    expect(flag).toBeDefined()
    const recovery = (receipt: typeof before.receipt) => hasRecordedRecoveryEvidence({ auditId: 'current',
      executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: url, environment: 'production', scope: 'DIAGNOSTIC',
        checks: { 'mobile-input-zoom': 2 }, outcomes: [], verificationTarget: null }, flag: { ...flag!, pageUrl: url },
      executions: [{ targetKey: 'module:mobile-ux-quality', status: 'COMPLETED', detail: receipt }] })
    expect(scopedAssertionForTarget({ receipt: before.receipt, checkId: 'mobile-input-zoom', flag: flag! })?.assertion.passed).toBe(false)
    expect(recovery(before.receipt)).toBe(false)
    size = 16
    const repaired = await inspect()
    expect(repaired.receipt.assertions.find(assertion => assertion.key === 'mobile-input-fonts')).toMatchObject({ passed: true, complete: true, disposition: 'observed' })
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: 'mobile-input-zoom', flag: flag! })).toBeUndefined()
    expect(recovery(repaired.receipt)).toBe(false)
    size = 14
    const recurring = await inspect()
    expect(scopedAssertionForTarget({ receipt: recurring.receipt, checkId: 'mobile-input-zoom', flag: flag! })?.assertion.passed).toBe(false)
    expect(recovery(recurring.receipt)).toBe(false)
    size = 16
    inputs = ''
    const absent = await inspect()
    expect(scopedAssertionForTarget({ receipt: absent.receipt, checkId: 'mobile-input-zoom', flag: flag! })).toBeUndefined()
    expect(recovery(absent.receipt)).toBe(false)
    inputs = '<input id="email" type="email">' + Array.from({ length: 200 }, (_, index) => `<input id="extra-${index}" type="text">`).join('')
    const bounded = await inspect()
    expect(bounded.receipt.assertions.find(assertion => assertion.key === 'mobile-input-fonts')).toMatchObject({ complete: false })
    expect(recovery(bounded.receipt)).toBe(false)
  })
})
