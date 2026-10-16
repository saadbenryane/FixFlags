import { createServer } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { auditPageObservation, bindAuditPageObservation } from './observation-scope'
import { MOBILE_CAPTURE_PROFILE } from './capture-profile'
import { measureMobileLayout } from '../capture-metrics'
import { runVisualPolishChecks } from '../checks/visual-polish'
import { runMobileUXQualityChecks } from '../checks/mobile-ux-quality'
import { parseMetadataFromHtml } from '../metadata'
import { scopeRenderedPageEvidence } from '../checks/rendered-page-evidence'
import { scopedAssertionForTarget } from '../checks/verification'
import type { CheckAssertion } from '../checks/assertion'
import { runCtaFocusChecks } from '../checks/cta-focus'
import { runVisualHierarchyChecks } from '../checks/visual-hierarchy'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native mobile layout visibility', () => {
  afterAll(closeBrowser)
  it('uses rendered labels and native input captions for mobile action measurements, and withholds truncated cohorts', async () => {
    const url = 'https://example.com/native-actions'
    const html = '<!doctype html><html><head><style>body{background:white}' +
      'button,input{display:block;margin:12px;padding:12px;font:600 16px Arial;background:#174ba5;color:white;border:0;border-radius:8px}' +
      '#utility{border-radius:28px}#secret{display:none}</style></head><body><main>' +
      '<button id="utility">Open summary<span hidden>Get started free</span></button>' +
      '<input type="button" value="Get started free"><input type="submit" value="Request demo">' +
      '<input id="secret" type="password" role="button" value="PRIVATE_FIELD_VALUE"></main></body></html>'
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: MOBILE_CAPTURE_PROFILE.width, height: MOBILE_CAPTURE_PROFILE.height } })
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: html }))
      await page.goto(url)
      bindAuditPageObservation(page, url, MOBILE_CAPTURE_PROFILE, undefined, [])
      const observe = () => measureMobileLayout(page, auditPageObservation(page)!.scope)
      const metrics = await observe()
      expect(metrics.mobilePrimaryCtaText).toBe('Get started free')
      expect(metrics.mobilePrimaryCtaTopPx).toBeGreaterThan(50)
      expect(metrics.competingPrimaryCtaLabels).toEqual(['Get started free', 'Request demo'])
      expect(metrics.buttonBorderRadii).toEqual([8])
      expect(metrics.buttonBorderRadiiComplete).toBe(true)
      expect(JSON.stringify(metrics)).not.toContain('PRIVATE_FIELD_VALUE')
      await page.evaluate(() => {
        const main = document.querySelector('main')!
        for (let index = 0; index < 2001; index++) {
          const button = document.createElement('button'); button.textContent = 'Start free'; main.append(button)
        }
      })
      const incomplete = await observe(), assertions: CheckAssertion[] = []
      expect(incomplete.mobilePrimaryCtaTopPx).toBeNull()
      expect(incomplete.mobilePrimaryCtaText).toBeNull()
      expect(incomplete.competingPrimaryCtaComplete).toBe(false)
      expect(incomplete.buttonBorderRadiiComplete).toBe(false)
      runVisualPolishChecks(incomplete, assertion => assertions.push(assertion))
      expect(assertions.find(assertion => assertion.key === 'button-radius-range')).toMatchObject({ complete: false })
    } finally { await context.close() }
  })
  it('distinguishes equally weighted actions from secondary styles without removing the secondary actions', async () => {
    const url = 'https://example.com/action-hierarchy'
    const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>' +
      'body{background:white}a{display:block;width:max-content;margin:12px 0;padding:12px 20px;font:600 16px Arial;background:#174ba5;color:white;border:1px solid #174ba5}' +
      '.secondary{background:transparent;color:#174ba5;border-color:transparent}' +
      '</style></head><body><main><h1>Useful service for teams</h1><p>Choose your next step.</p>' +
      '<a href="/signup">Get started</a><a id="demo" href="/demo">Request demo</a><a id="pricing" href="/pricing">Pricing</a></main></body></html>'
    const browser = await getAuditBrowser(), context = await browser.newContext({ viewport: { width: MOBILE_CAPTURE_PROFILE.width, height: MOBILE_CAPTURE_PROFILE.height },
      userAgent: MOBILE_CAPTURE_PROFILE.userAgent, isMobile: MOBILE_CAPTURE_PROFILE.isMobile, hasTouch: MOBILE_CAPTURE_PROFILE.hasTouch })
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: html }))
      await page.goto(url)
      bindAuditPageObservation(page, url, MOBILE_CAPTURE_PROFILE, undefined, [])
      const observe = () => measureMobileLayout(page, auditPageObservation(page)!.scope)
      const before = await observe()
      expect(before.competingPrimaryCtaCount).toBe(3)
      expect(before.competingPrimaryCtaComplete).toBe(true)
      expect(before.competingPrimaryCtaSamples).toEqual(['Get started', 'Request demo', 'Pricing'].map(label => ({
        label, surface: 'filled', fontSize: 16, fontWeight: 600, height: expect.any(Number),
      })))
      expect(runCtaFocusChecks(before).map(flag => flag.checkId)).toContain('competing-ctas')
      const meta = parseMetadataFromHtml(html, url)
      expect(runVisualHierarchyChecks(meta, before).map(flag => flag.checkId)).toContain('hierarchy-competing-actions')
      await page.locator('#demo, #pricing').evaluateAll(elements => elements.forEach(element => element.classList.add('secondary')))
      const after = await observe()
      expect(await page.locator('main a:visible').count()).toBe(3)
      expect(after.competingPrimaryCtaCount).toBe(1)
      expect(after.competingPrimaryCtaLabels).toEqual(['Get started'])
      expect(runCtaFocusChecks(after)).toEqual([])
      expect(runVisualHierarchyChecks(meta, after).map(flag => flag.checkId)).not.toContain('hierarchy-competing-actions')
      await page.addStyleTag({ content: 'a,.secondary{background:transparent;color:#174ba5;border:1px solid #174ba5}' })
      expect((await observe()).competingPrimaryCtaCount).toBe(3)
      await page.addStyleTag({ content: '#demo,#pricing{font-size:10px;font-weight:400}' })
      expect((await observe()).competingPrimaryCtaCount).toBe(1)
      await page.addStyleTag({ content: '#demo,#pricing{font-size:16px;font-weight:600}a{background-image:linear-gradient(#174ba5,black)}' })
      const unknown = await observe(), assertions: CheckAssertion[] = []
      expect(unknown.competingPrimaryCtaComplete).toBe(false)
      expect(runCtaFocusChecks(unknown, assertion => assertions.push(assertion))).toEqual([])
      expect(runVisualHierarchyChecks(meta, unknown, assertion => assertions.push(assertion)).map(flag => flag.checkId)).not.toContain('hierarchy-competing-actions')
      expect(assertions.filter(assertion => ['primary-action-count', 'prominent-action-count'].includes(assertion.key)))
        .toEqual([expect.objectContaining({ passed: false, complete: false }), expect.objectContaining({ passed: false, complete: false })])
    } finally { await context.close() }
  })
  it.each(['none', 'duplicate', 'unique'])('does not let another same-named field certify recovery after the original form disappears (IDs: %s)', async ids => {
    const url = 'https://example.com/forms'
    const firstId = ids === 'none' ? '' : ids === 'duplicate' ? ' id="email"' : ' id="signup-email"'
    const secondId = ids === 'none' ? '' : ids === 'duplicate' ? ' id="email"' : ' id="newsletter-email"'
    const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1">' +
      '<style>input{font-size:16px}#original input{font-size:12px}</style></head><body><main>' +
      '<form id="original"><label>Signup email<input type="email" name="email"' + firstId + '></label></form>' +
      '<form id="footer"><label>Newsletter email<input type="email" name="email"' + secondId + '></label></form></main></body></html>'
    const browser = await getAuditBrowser()
    const context = await browser.newContext({ viewport: { width: MOBILE_CAPTURE_PROFILE.width, height: MOBILE_CAPTURE_PROFILE.height },
      userAgent: MOBILE_CAPTURE_PROFILE.userAgent, isMobile: MOBILE_CAPTURE_PROFILE.isMobile, deviceScaleFactor: MOBILE_CAPTURE_PROFILE.deviceScaleFactor,
      hasTouch: MOBILE_CAPTURE_PROFILE.hasTouch, locale: 'en-US' })
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: html }))
      await page.goto(url)
      bindAuditPageObservation(page, url, MOBILE_CAPTURE_PROFILE, undefined, [])
      const observe = async () => {
        const scope = auditPageObservation(page)!.scope, assertions: CheckAssertion[] = []
        const metrics = await measureMobileLayout(page, scope)
        const flags = runMobileUXQualityChecks(metrics, 'marketing', assertion => assertions.push(assertion))
        return scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags, assertions, mobile: scope })
      }
      const before = await observe(), flag = before.flags.find(flag => flag.checkId === 'mobile-input-zoom')!
      expect(flag).toBeDefined()
      expect(await page.locator(flag.evidenceTargets![0].selector!).count()).toBe(1)
      const proof = (observed: typeof before, source = flag) => scopedAssertionForTarget({ checkId: source.checkId, flag: source, receipt: {
        kind: 'site-module-check', version: 1, module: 'mobile-ux-quality', pageUrl: url, applicable: true,
        complete: true, passed: observed.flags.length === 0, assertions: observed.assertions,
        execution: { auditId: 'after', taskId: 'mobile', checkVersion: 2, source: 'rendered-dom', collectedAt: new Date().toISOString() },
      } })
      await page.locator('#original').evaluate(element => element.remove())
      const after = await observe()
      expect(after.flags.some(finding => finding.checkId === flag.checkId)).toBe(false)
      expect(proof(after)).toBeUndefined()
      await page.goto(url)
      await page.locator('#original input').evaluate(element => element.setAttribute('type', 'text'))
      expect(proof(await observe())).toBeUndefined()
      await page.locator('#original input').evaluate(element => element.setAttribute('type', 'email'))
      expect(proof(await observe())?.assertion.passed).toBe(false)
      await page.locator('#original label').evaluate(element => document.getElementById('footer')!.append(element))
      expect(proof(await observe())).toBeUndefined()
      await page.locator('#footer label').last().evaluate(element => document.getElementById('original')!.append(element))
      await page.addStyleTag({ content: '#original input{font-size:16px}' })
      await page.locator('#original input').fill('PRIVATE_INPUT_VALUE@example.test')
      const repaired = await observe()
      expect(proof(repaired)?.assertion.passed).toBe(true)
      expect(JSON.stringify(repaired)).not.toContain('PRIVATE_INPUT_VALUE')
      await page.locator('main').evaluate(element => element.insertAdjacentHTML('beforeend', '<form id="additional"><label>Another field<input type="text" name="another" style="font-size:12px"></label></form>'))
      expect(proof(await observe())?.assertion.passed).toBe(true)
      const legacy = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', mobile: auditPageObservation(page)!.scope, assertions: [],
        flags: [{ ...flag, verificationRule: undefined, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target, context: undefined })) }] }).flags[0]
      expect(proof(repaired, legacy)).toBeUndefined()
    } finally { await context.close() }
  })
  it('keeps indistinguishable anonymous fields unverified when one replaces the other in document order', async () => {
    const browser = await getAuditBrowser(), context = await browser.newContext({ viewport: { width: MOBILE_CAPTURE_PROFILE.width, height: MOBILE_CAPTURE_PROFILE.height },
      userAgent: MOBILE_CAPTURE_PROFILE.userAgent, isMobile: MOBILE_CAPTURE_PROFILE.isMobile, deviceScaleFactor: MOBILE_CAPTURE_PROFILE.deviceScaleFactor,
      hasTouch: MOBILE_CAPTURE_PROFILE.hasTouch, locale: 'en-US' })
    try {
      const page = await context.newPage(), url = 'https://example.com/anonymous-forms'
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<main><form><label>Email<input name="email" style="font-size:12px"></label></form>' +
        '<form><label>Email<input name="email" style="font-size:16px"></label></form></main>' }))
      await page.goto(url)
      bindAuditPageObservation(page, url, MOBILE_CAPTURE_PROFILE, undefined, [])
      const metrics = await measureMobileLayout(page, auditPageObservation(page)!.scope)
      expect(metrics.inputFontSamples?.map(sample => sample.context)).toEqual(['mobile-input:unknown', 'mobile-input:unknown'])
      expect(new Set(metrics.inputFontSamples?.map(sample => sample.selector)).size).toBe(2)
      const assertions: CheckAssertion[] = []
      const flags = runMobileUXQualityChecks(metrics, 'marketing', assertion => assertions.push(assertion))
      const observed = scopeRenderedPageEvidence({ module: 'mobile-ux-quality', flags, assertions, mobile: auditPageObservation(page)!.scope })
      expect(observed.flags.find(flag => flag.checkId === 'mobile-input-zoom')?.evidenceTargets?.[0].context).toBe('rendered-page:unknown')
      expect(observed.assertions.filter(assertion => assertion.key === 'mobile-input-fonts').every(assertion => assertion.complete === false)).toBe(true)
    } finally { await context.close() }
  })
  it('excludes hidden and transparent cohorts while retaining visible descendants and below-fold controls', async () => {
    const html = '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Useful mobile layout fixture</title><style>' +
      'body{font-family:Arial}a,button{display:inline-block;padding:12px;border-radius:8px}input{font-size:16px}' +
      '.hidden-font{font-family:Georgia}.hidden-action{font-family:Courier;border-radius:40px}.tiny{font-size:12px}' +
      '</style></head><body><main><h1>Useful service for teams</h1>' +
      '<section hidden><h2 class="hidden-font">Hidden heading</h2><a class="hidden-action" href="/register">Register hidden</a></section>' +
      '<section id="transparent" style="opacity:0"><h2 class="hidden-font">Transparent heading</h2><h2 style="font-family:Verdana">Transparent label</h2>' +
      '<a class="hidden-action" href="/register">Register transparent</a>' +
      '<a href="/signup" style="font-family:monospace;border-radius:0px">Try free ghost</a>' +
      '<a href="/signup" style="font-family:serif;border-radius:20px">Get started ghost</a><input class="tiny" id="hidden-input"></section>' +
      '<section style="visibility:hidden"><input class="tiny" id="invisible-input"><input id="visible-override" style="visibility:visible;font-size:13px"></section>' +
      '<a id="visible-action" href="/signup">Get started free</a><input id="visible-input">' +
      '<section style="margin-top:1000px"><a href="/pricing">Pricing</a><input id="deep-input" class="tiny"></section>' +
      '</main></body></html>'
    const server = createServer((_request, response) => { response.setHeader('content-type', 'text/html'); response.end(html) })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      const session = await createAuditPage(await getAuditBrowser(), url, { profile: MOBILE_CAPTURE_PROFILE, allowLocalhost: true, deadline: Date.now() + 10_000 })
      try {
        const metrics = await measureMobileLayout(session.page, auditPageObservation(session.page)?.scope)
        expect(metrics.fontFamilySample).not.toContain('Georgia')
        expect(metrics.fontFamilySample).not.toContain('Courier')
        expect(metrics.buttonBorderRadii).toEqual([8])
        expect(metrics.inputsBelow16px).toEqual([{ selector: '#visible-override', fontSize: 13 }, { selector: '#deep-input', fontSize: 12 }])
        expect(metrics.mobilePrimaryCtaText).toBe('Get started free')
        expect(metrics.competingPrimaryCtaCount).toBe(1)
        expect(runVisualPolishChecks(metrics).some(flag => ['visual-typography-sprawl', 'visual-radius-inconsistent'].includes(flag.checkId))).toBe(false)
        expect(runMobileUXQualityChecks(metrics).find(flag => flag.checkId === 'mobile-input-zoom')?.evidence).toContain('#deep-input')
        await session.page.locator('#transparent').evaluate(element => (element as HTMLElement).style.opacity = '1')
        const visible = await measureMobileLayout(session.page, auditPageObservation(session.page)?.scope)
        expect(runVisualPolishChecks(visible).map(flag => flag.checkId)).toEqual(expect.arrayContaining(['visual-typography-sprawl', 'visual-radius-inconsistent']))
        await session.page.locator('#transparent').evaluate(element => (element as HTMLElement).style.opacity = '0')
        await session.page.locator('#visible-action').evaluate(element => element.remove())
        expect((await measureMobileLayout(session.page, auditPageObservation(session.page)?.scope)).mobilePrimaryCtaText).toBe('Pricing')
      } finally { session.disposeNetwork(); await session.page.context().close() }
    } finally {
      vi.unstubAllEnvs(); server.closeAllConnections()
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }, 30_000)
})
