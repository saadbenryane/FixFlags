import type { Browser, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import { collectKeyboardEvidence } from '../browser/keyboard-probe'
import { attachNetworkMonitor } from '../browser/network-monitor'
import { classifyTrackingEndpoint } from './endpoints'
import { runTrackingChecks } from '../checks/tracking'
import { parseMetadataFromHtml } from '../metadata'

const runBrowser = process.env.TRACKING_BROWSER_REQUIRED === 'true' ? describe : describe.skip
runBrowser('shared Tracking collector in Chromium', () => {
  let browser: Browser, page: Page
  beforeAll(async () => { browser = await getAuditBrowser() })
  afterEach(async () => { await page?.context().close() })
  afterAll(closeBrowser)
  async function fixture(html: string, libraryStatus = 200) {
    const session = await createAuditPage(browser, 'https://example.com/', {
      profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, settle: false,
      configurePage: async fixturePage => {
        page = fixturePage
        // Only controlled HTML/scripts are fulfilled. Event attempts fall through
        // to the production boundary; no provider receives test traffic.
        await page.route('**', async route => {
          const kind = classifyTrackingEndpoint(route.request().url(), route.request().resourceType(), 'https://example.com/')
          if (kind?.role === 'event') return route.fallback()
          await route.fulfill({ status: kind?.role === 'library' ? libraryStatus : 200,
            contentType: kind?.role === 'library' ? 'application/javascript' : 'text/html',
            body: kind?.role === 'library' ? 'window.libraryLoaded=true; navigator.sendBeacon("https://www.google-analytics.com/g/collect?cid=PRIVATE", "PRIVATE_PAYLOAD")' : '<!doctype html><html><body>' + html + '</body></html>' })
        })
      },
    })
    return session
  }
  it('allows the library transfer and observes a beacon attempt while suppressing actual collection', async () => {
    const session = await fixture('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>')
    await page.waitForFunction(() => (window as unknown as { libraryLoaded?: boolean }).libraryLoaded)
    await page.waitForTimeout(50)
    const evidence = session.tracking('page_load')
    expect(evidence.requests).toMatchObject([{ role: 'library', state: 'completed', status: 200 }, { role: 'event', state: 'suppressed', status: null }])
    expect(JSON.stringify(evidence)).not.toContain('PRIVATE')
    expect(session.safetyRestrictions).toEqual([])
    expect(session.networkFailures).toEqual([])
    session.disposeNetwork()
  })
  it('reports an actual HTTP library failure and leaves consent-delayed silence unknown without clicking', async () => {
    let session = await fixture('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>', 404)
    await page.waitForTimeout(50)
    const metadata = parseMetadataFromHtml(await page.content(), page.url())
    expect(runTrackingChecks(metadata, session.tracking(), page.url()).flags[0].checkId).toBe('tracking-library-http-error')
    session.disposeNetwork(); await page.context().close()
    session = await fixture('<div id="cookie-consent">Cookie consent<button onclick="document.body.dataset.accepted=\'yes\'">Accept</button></div><script type="text/plain" src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>')
    expect(session.tracking().requests).toEqual([])
    expect(await page.locator('body').getAttribute('data-accepted')).toBeNull()
    expect(runTrackingChecks(parseMetadataFromHtml(await page.content(), page.url()), session.tracking(), page.url()).flags).toEqual([])
    session.disposeNetwork()
  })
  it('reuses the same monitor for a public interaction and keeps it separate from page loading', async () => {
    const session = await fixture('<button id="action" onclick="navigator.sendBeacon(\'https://www.google-analytics.com/g/collect?cid=PRIVATE\',\'PRIVATE_PAYLOAD\')">Show details</button>')
    session.setTrackingPhase('public_action')
    await page.locator('#action').click(); await page.waitForTimeout(50)
    expect(session.tracking('page_load').requests).toEqual([])
    expect(session.tracking('public_action').requests).toMatchObject([{ phase: 'public_action', role: 'event', state: 'suppressed' }])
    expect(session.safetyRestrictions).toEqual([])
    session.disposeNetwork()
  })
  it('keeps recognized telemetry from invalidating independent keyboard navigation', async () => {
    const session = await fixture('<button onfocus="navigator.sendBeacon(\'https://www.google-analytics.com/g/collect\',\'PRIVATE_PAYLOAD\')">Details</button><button>Next</button>')
    const keyboard = await collectKeyboardEvidence(page, Date.now() + 8000)
    expect(keyboard.navigationComplete).toBe(true)
    expect(keyboard.limitations).not.toContain('protected_action_refused')
    expect(session.tracking().requests.some(request => request.role === 'event' && request.state === 'suppressed')).toBe(true)
    session.disposeNetwork()
  })
  it('captures endpoint responses independently of ingestion using controlled transport', async () => {
    const context = await browser.newContext(); page = await context.newPage()
    const monitor = attachNetworkMonitor(page, 'https://example.com/')
    await page.route('**', route => route.fulfill({ status: route.request().resourceType() === 'document' ? 200 : 204,
      contentType: 'text/html', body: route.request().resourceType() === 'document' ? '<script>fetch("/_vercel/insights/view?cid=PRIVATE",{method:"POST",body:"PRIVATE_PAYLOAD"})</script>' : '' }))
    await page.goto('https://example.com/'); await page.waitForTimeout(50)
    const result = runTrackingChecks(parseMetadataFromHtml('', page.url()), monitor.tracking(), page.url())
    expect(result.assertions.find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: true, complete: true })
    expect(result.assertions.find(item => item.key === 'tracking-provider-recording')).toMatchObject({ complete: false })
    expect(JSON.stringify(monitor.tracking())).not.toContain('PRIVATE')
    monitor.dispose()
  })
})
