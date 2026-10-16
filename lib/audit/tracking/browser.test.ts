import type { Browser, Page } from 'playwright'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import { collectKeyboardEvidence } from '../browser/keyboard-probe'
import { attachNetworkMonitor } from '../browser/network-monitor'
import { classifyTrackingEndpoint } from './endpoints'
import { runTrackingChecks } from '../checks/tracking'
import { parseMetadataFromHtml } from '../metadata'
import { scopedAssertionForTarget } from '../checks/verification'
import { checkReceiptSchema } from '../checks/receipt'

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
    await vi.waitFor(() => expect(session.tracking().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'library', state: 'completed', status: 200 }),
      expect.objectContaining({ role: 'event', state: 'suppressed' }),
    ])))
    const evidence = session.tracking('page_load')
    expect(evidence.requests).toMatchObject([{ role: 'library', state: 'completed', status: 200 }, { role: 'event', state: 'suppressed', status: null }])
    expect(JSON.stringify(evidence)).not.toContain('PRIVATE')
    expect(session.safetyRestrictions).toEqual([])
    expect(session.networkFailures).toEqual([])
    session.disposeNetwork()
  })
  it('reports an actual HTTP library failure and leaves consent-delayed silence unknown without clicking', async () => {
    let session = await fixture('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>', 404)
    await vi.waitFor(() => expect(session.tracking().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'library', status: 404 }),
    ])))
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
    const session = await fixture('<button id="action" onclick="navigator.sendBeacon(\'https://www.google-analytics.com/g/collect?cid=PRIVATE\',\'PRIVATE_PAYLOAD\');location.hash=\'details\'">Show details</button>')
    const loadingCapture = session.tracking('page_load').captureKey
    session.setTrackingPhase('public_action')
    await page.locator('#action').click()
    await vi.waitFor(() => expect(session.tracking('public_action').requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'event', state: 'suppressed' }),
    ])))
    expect(session.tracking('page_load').requests).toEqual([])
    expect(session.tracking('public_action').requests).toMatchObject([{ phase: 'public_action', role: 'event', state: 'suppressed' }])
    expect(session.tracking('page_load').captureKey).toBe(loadingCapture)
    expect(session.tracking('public_action').captureKey).not.toBe(loadingCapture)
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
    await page.goto('https://example.com/')
    // Chromium can report a bodyless 204 transfer as aborted after fetch has
    // resolved. This contract records the HTTP response, not event ingestion.
    await vi.waitFor(() => expect(monitor.tracking().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'event', status: 204 }),
    ])))
    const result = runTrackingChecks(parseMetadataFromHtml('', page.url()), monitor.tracking(), page.url())
    expect(result.assertions.find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: true, complete: true })
    expect(result.assertions.find(item => item.key === 'tracking-provider-recording')).toMatchObject({ complete: false })
    expect(JSON.stringify(monitor.tracking())).not.toContain('PRIVATE')
    monitor.dispose()
  })

  it('keeps a changed library project distinct from repair of the original request', async () => {
    async function observe(project: string, status: number) {
      const session = await fixture('<script src="https://cdn.segment.com/analytics.js/v1/' + project + '/analytics.min.js"></script>', status)
      await vi.waitFor(() => expect(session.tracking().requests.find(request => request.role === 'library' && request.status === status)?.state)
        .toMatch(/^(completed|failed)$/))
      const result = runTrackingChecks(parseMetadataFromHtml(await page.content(), page.url()), session.tracking(), page.url())
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl: page.url(),
        applicable: true, passed: result.flags.length === 0 && result.complete, complete: result.complete, assertions: result.assertions,
        execution: { auditId: 'after', taskId: 'library', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
      session.disposeNetwork(); await page.context().close()
      return { ...result, receipt }
    }
    const before = await observe('PRIVATE_ORIGINAL', 404)
    const changed = await observe('PRIVATE_REPLACEMENT', 200)
    expect(scopedAssertionForTarget({ receipt: changed.receipt, checkId: 'tracking-library-http-error', flag: before.flags[0] })).toBeUndefined()
    const repaired = await observe('PRIVATE_ORIGINAL', 200)
    expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: 'tracking-library-http-error', flag: before.flags[0] })?.assertion.passed).toBe(true)
    expect(JSON.stringify([before.flags, before.receipt, changed.receipt, repaired.receipt])).not.toContain('PRIVATE_')
  })
})
