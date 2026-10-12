import type { Browser, BrowserContext, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { measureMobileLayout, measureMotionA11y } from '../../capture-metrics'
import { runInteractionChecks } from '../../checks/interaction'
import { runMobileUXQualityChecks } from '../../checks/mobile-ux-quality'
import { runLayoutChecks } from '../../checks/layout'
import { parseMetadataFromHtml } from '../../metadata'
import type { CheckAssertion } from '../../checks/assertion'

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
    const metadata = parseMetadataFromHtml(await page.content(), url)
    const before = await measureMobileLayout(page)
    expect(before.inputsBelow16px).toContainEqual({ selector: '#email', fontSize: 12 })
    expect(runMobileUXQualityChecks(metadata, before).map(flag => flag.checkId)).toContain('mobile-input-zoom')
    await page.addStyleTag({ content: 'input{font-size:16px}' })
    const after = await measureMobileLayout(page)
    const observations: CheckAssertion[] = []
    runMobileUXQualityChecks(metadata, after, 'marketing', assertion => observations.push(assertion))
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
})
