import { createServer } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage } from './page-session'
import { auditPageObservation } from './observation-scope'
import { MOBILE_CAPTURE_PROFILE } from './capture-profile'
import { measureMobileLayout } from '../capture-metrics'
import { runVisualPolishChecks } from '../checks/visual-polish'
import { runMobileUXQualityChecks } from '../checks/mobile-ux-quality'
import { parseMetadataFromHtml } from '../metadata'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native mobile layout visibility', () => {
  afterAll(closeBrowser)
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
        expect(runMobileUXQualityChecks(parseMetadataFromHtml(html, url), metrics).find(flag => flag.checkId === 'mobile-input-zoom')?.evidence).toContain('#deep-input')
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
