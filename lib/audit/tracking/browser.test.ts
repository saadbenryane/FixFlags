import type { Browser, Page } from 'playwright'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { gzipSync } from 'node:zlib'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../screenshot'
import { createAuditPage as createPage, type CreateAuditPageOptions } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import { collectKeyboardEvidence } from '../browser/keyboard-probe'
import { attachNetworkMonitor } from '../browser/network-monitor'
import { auditPageObservation, bindAuditPageObservation, captureObservationKey } from '../browser/observation-scope'
import { classifyTrackingEndpoint } from './endpoints'
import { trackingEvidenceSchema } from './contracts'
import { runTrackingChecks } from '../checks/tracking'
import { networkEngagementObservations } from '../checks/network-engagement'
import { ENGAGEMENT_VERIFICATION_RULE } from '../network-engagement-evidence'
import { parseMetadataFromHtml } from '../metadata'
import { scopedAssertionForTarget } from '../checks/verification'
import { checkReceiptSchema, readCheckReceipt } from '../checks/receipt'

const runBrowser = process.env.TRACKING_BROWSER_REQUIRED === 'true' ? describe : describe.skip
const createAuditPage = (browser: Browser, url: string, options: CreateAuditPageOptions) =>
  createPage(browser, url, { ...options, collectTrackingLibraries: true })
runBrowser('shared Tracking collector in Chromium', () => {
  let browser: Browser, page: Page
  beforeAll(async () => { browser = await getAuditBrowser() })
  afterEach(async () => { await page?.context().close() })
  afterAll(closeBrowser)
  async function fixture(html: string, libraryStatus = 200, libraryGate?: Promise<void>) {
    const session = await createAuditPage(browser, 'https://example.com/', {
      profile: DESKTOP_CAPTURE_PROFILE, journeySafe: true, settle: false,
      configurePage: async fixturePage => {
        page = fixturePage
        // Only controlled HTML/scripts are fulfilled. Event attempts fall through
        // to the production boundary; no provider receives test traffic.
        await page.route('**', async route => {
          const kind = classifyTrackingEndpoint(route.request().url(), route.request().resourceType(), 'https://example.com/')
          if (kind?.role === 'event') return route.fallback()
          if (kind?.role === 'library') await libraryGate
          await route.fulfill({ status: kind?.role === 'library' ? libraryStatus : 200,
            contentType: kind?.role === 'library' ? 'application/javascript' : 'text/html',
            body: kind?.role === 'library' ? 'window.libraryLoaded=true; navigator.sendBeacon("https://www.google-analytics.com/g/collect?cid=PRIVATE", "PRIVATE_PAYLOAD")' : '<!doctype html><html><body>' + html + '</body></html>' })
        })
      },
    })
    return session
  }
  it('records a library response received after a public click returns', async () => {
    let release!: () => void
    const libraryGate = new Promise<void>(resolve => { release = resolve })
    const session = await fixture(`<button onclick="const script=document.createElement('script');
      script.src='https://www.googletagmanager.com/gtag/js?id=G-PRIVATE'; document.head.append(script)">Details</button>`, 503, libraryGate)
    try {
      session.setTrackingPhase('public_action')
      await page.getByRole('button', { name: 'Details' }).click()
      await vi.waitFor(() => expect(session.tracking('public_action').requests).toMatchObject([{ role: 'library', state: 'pending' }]))
      let settled = false
      const waiting = session.settleNetwork(Date.now() + 2000, { tracking: 'public_action' }).then(() => { settled = true })
      await new Promise(resolve => setImmediate(resolve))
      expect(settled).toBe(false)
      release()
      await waiting
      const evidence = session.tracking('public_action')
      expect(evidence.requests).toMatchObject([{ status: 503, phase: 'public_action' }])
      expect(runTrackingChecks(null, evidence, page.url()).flags).toMatchObject([{ checkId: 'tracking-library-http-error' }])
      expect(JSON.stringify(evidence)).not.toContain('G-PRIVATE')
    } finally { release(); session.disposeNetwork() }
  })
  it('allows the library transfer and observes a beacon attempt while suppressing actual collection', async () => {
    const session = await fixture('<script src="https://www.googletagmanager.com/gtag/js?id=G-PRIVATE"></script>')
    await page.waitForFunction(() => (window as unknown as { libraryLoaded?: boolean }).libraryLoaded)
    await vi.waitFor(() => expect(session.tracking().requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'library', state: 'completed', status: 200 }),
      expect.objectContaining({ role: 'event', state: 'suppressed' }),
    ])))
    const evidence = session.tracking('page_load')
    expect(evidence.requests).toMatchObject([{ role: 'library', state: 'completed', status: 200, libraryResponseQualified: true },
      { role: 'event', state: 'suppressed', status: null }])
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
  it('redacts a Plausible site script from live browser evidence while suppressing its event', async () => {
    const session = await fixture('<script src="https://plausible.io/js/pa-PRIVATE_SITE.js"></script>' +
      '<script>navigator.sendBeacon("https://plausible.io/api/event", "PRIVATE_EVENT")</script>', 503)
    try {
      await vi.waitFor(() => expect(session.tracking().requests).toEqual(expect.arrayContaining([
        expect.objectContaining({ provider: 'plausible', role: 'library', status: 503, endpoint: '/js/script.js' }),
        expect.objectContaining({ provider: 'plausible', role: 'event', state: 'suppressed', status: null }),
      ])))
      const evidence = session.tracking()
      const checks = runTrackingChecks(parseMetadataFromHtml(await page.content(), page.url()), evidence, page.url())
      expect(checks.flags).toMatchObject([{ checkId: 'tracking-library-http-error', evidence: expect.stringContaining('plausible.io/js/script.js') }])
      expect(JSON.stringify([evidence, checks, session.technologyResources])).not.toContain('PRIVATE_')
    } finally { session.disposeNetwork() }
  })
  it('reuses the same monitor for a public interaction and keeps it separate from page loading', async () => {
    const session = await fixture('<button id="action" onclick="navigator.sendBeacon(\'https://www.google-analytics.com/g/collect?cid=PRIVATE\',\'PRIVATE_PAYLOAD\')">Show details</button>')
    const originalCapture = captureObservationKey(auditPageObservation(page)!.scope)
    session.setTrackingPhase('public_action')
    await page.locator('#action').click()
    await vi.waitFor(() => expect(session.tracking('public_action').requests).toEqual(expect.arrayContaining([
      expect.objectContaining({ role: 'event', state: 'suppressed' }),
    ])))
    await page.goto('https://example.com/details')
    const nextCapture = captureObservationKey(auditPageObservation(page)!.scope)
    await page.locator('#action').click()
    await vi.waitFor(() => expect(session.tracking('public_action').requests).toHaveLength(2))
    expect(session.tracking('page_load').requests).toEqual([])
    expect(session.tracking('public_action').requests).toMatchObject([
      { phase: 'public_action', role: 'event', state: 'suppressed', captureKey: originalCapture },
      { phase: 'public_action', role: 'event', state: 'suppressed', captureKey: nextCapture },
    ])
    expect(nextCapture).not.toBe(originalCapture)
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

  it('blocks recognized event destinations requested as scripts, frames or library redirects', async () => {
    const deliveries: string[] = []
    const server = createServer((request, response) => {
      const path = request.url!
      if (path.startsWith('/_vercel/insights/view')) {
        deliveries.push(path)
        response.writeHead(200, { 'content-type': 'application/javascript' }).end('window.eventReached = true')
      } else if (path === '/_vercel/insights/script.js?redirect') {
        response.writeHead(302, { location: '/_vercel/insights/view?from=redirect' }).end()
      } else if (path === '/_vercel/insights/script.js') {
        response.writeHead(200, { 'content-type': 'application/javascript' }).end('window.libraryLoaded = true')
      } else {
        response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html>' +
          '<script src="/_vercel/insights/script.js"></script>' +
          '<script src="/_vercel/insights/view?from=script"></script>' +
          '<script src="/_vercel/insights/script.js?redirect"></script>' +
          '<iframe src="/_vercel/insights/view?from=frame"></iframe>')
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
    try {
      const session = await createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false })
      page = session.page
      try {
        await page.waitForLoadState('load')
        expect(await page.evaluate(() => Reflect.get(window, 'libraryLoaded'))).toBe(true)
        expect(deliveries).toEqual([])
        const evidence = session.tracking()
        expect(evidence.requests).toEqual(expect.arrayContaining([
          expect.objectContaining({ role: 'library', status: 200, state: 'completed' }),
          expect.objectContaining({ role: 'library', state: 'failed' }),
        ]))
        expect(evidence.requests.filter(request => request.role === 'event')).toMatchObject([
          { state: 'suppressed', status: null }, { state: 'suppressed', status: null },
        ])
        expect(runTrackingChecks(null, evidence, url).assertions.filter(item => item.key === 'tracking-library'))
          .toEqual(expect.arrayContaining([expect.objectContaining({ passed: true }), expect.objectContaining({ complete: false })]))
        expect(session.safetyRestrictions).toEqual([])
        expect(JSON.stringify(evidence)).not.toContain('from=')
      } finally { session.disposeNetwork(); await page.context().close() }
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })

  it.each([false, true])('suppresses first-party telemetry on the committed document after a cross-origin redirect (caller policy: %s)', async withPolicy => {
    let deliveries = 0
    const destination = createServer((request, response) => {
      if (request.url?.startsWith('/_vercel/insights/view')) {
        deliveries++
        response.writeHead(204).end()
      } else if (request.url === '/telemetry-redirect') {
        response.writeHead(302, { location: '/_vercel/insights/view?phase=redirect' }).end()
      } else if (request.url === '/_vercel/insights/script.js') {
        response.writeHead(200, { 'content-type': 'application/javascript' }).end(`
          Promise.allSettled([
            fetch('/_vercel/insights/view?phase=load', {method:'POST', body:'PRIVATE_PAYLOAD'}),
            fetch('/telemetry-redirect')
          ]).then(() => {document.documentElement.dataset.attempted = 'yes'});
        `)
      } else {
        response.writeHead(200, { 'content-type': 'text/html' }).end(`<!doctype html><script src="/_vercel/insights/script.js"></script>
          <button onfocus="fetch('/_vercel/insights/view?phase=focus',{method:'POST',body:'PRIVATE_PAYLOAD'}).catch(()=>{})">Details</button>`)
      }
    })
    await new Promise<void>(resolve => destination.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(destination.address() as AddressInfo).port}/`
    const entry = createServer((_request, response) => response.writeHead(302, { location: url }).end())
    await new Promise<void>(resolve => entry.listen(0, '127.0.0.1', resolve))
    try {
      const policy = vi.fn(async (request: { url: string }) => !new URL(request.url).pathname.startsWith('/_vercel/insights/view'))
      const session = await createAuditPage(browser, `http://127.0.0.1:${(entry.address() as AddressInfo).port}/`, {
        profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false,
        ...(withPolicy ? { requestPolicy: policy } : {}),
      })
      page = session.page
      try {
        expect(page.url()).toBe(url)
        await page.waitForFunction(() => document.documentElement.dataset.attempted === 'yes')
        expect(deliveries).toBe(0)
        expect(session.tracking().requests).toMatchObject([
          { provider: 'vercel', role: 'library', state: 'completed', status: 200 },
          { provider: 'vercel', role: 'event', state: 'suppressed', status: null },
          { provider: 'vercel', role: 'event', state: 'suppressed', status: null },
        ])
        session.setTrackingPhase('public_action')
        const keyboard = await collectKeyboardEvidence(page, Date.now() + 8000)
        expect(keyboard).toMatchObject({ navigationComplete: true, limitations: [] })
        await vi.waitFor(() => expect(session.tracking('public_action').requests).toMatchObject([
          { provider: 'vercel', role: 'event', state: 'suppressed', status: null },
        ]))
        if (withPolicy) expect(policy).toHaveBeenCalled()
        expect(policy.mock.calls.map(([request]) => new URL(request.url).pathname)).not.toContain('/_vercel/insights/view')
        expect(session.safetyRestrictions).toEqual([])
        expect(deliveries).toBe(0)
      } finally { session.disposeNetwork(); await page.context().close() }
    } finally {
      for (const server of [entry, destination]) {
        server.closeAllConnections()
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    }
  })

  it('flags and verifies engagement on a real redirected origin even when unrelated failures fill the generic list', async () => {
    let status = 503
    const destination = createServer((request, response) => {
      if (request.url?.startsWith('/noise/')) { response.writeHead(404).end(); return }
      if (request.url?.startsWith('/api/contact')) { response.writeHead(status).end(); return }
      response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><main><h1>Contact our team</h1></main>')
    })
    await new Promise<void>(resolve => destination.listen(0, '127.0.0.1', resolve))
    const reached = `http://127.0.0.1:${(destination.address() as AddressInfo).port}/`
    const entry = createServer((_request, response) => response.writeHead(302, { location: reached }).end())
    await new Promise<void>(resolve => entry.listen(0, '127.0.0.1', resolve))
    const pageUrl = `http://127.0.0.1:${(entry.address() as AddressInfo).port}/`
    try {
      async function observe(fillGenericList: boolean) {
        const session = await createAuditPage(browser, pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false })
        try {
          expect(session.page.url()).toBe(reached)
          await session.page.evaluate(async fill => {
            if (fill) await Promise.all(Array.from({ length: 40 }, (_, index) => fetch('/noise/' + index).then(response => response.text())))
            await fetch('/api/contact?key=PRIVATE_REQUEST').then(response => response.text())
          }, fillGenericList)
          await session.settleNetwork(Date.now() + 2000, { engagement: 'all' })
          expect(session.networkFailures.some(failure => failure.engagementPath)).toBe(status >= 400 && !fillGenericList)
          const evidence = session.engagement()
          expect(evidence.requests).toMatchObject([{ status, state: 'completed', destination: reached + 'api/contact' }])
          return networkEngagementObservations({ pageUrl, failures: session.networkFailures, evidence })
        } finally { session.disposeNetwork(); await session.page.context().close() }
      }
      const failure = await observe(true)
      const [flag] = failure.flags
      expect(flag).toMatchObject({ checkId: 'api-engagement-server-error', verificationRule: ENGAGEMENT_VERIFICATION_RULE })
      expect(JSON.stringify(failure)).not.toContain('PRIVATE_REQUEST')
      status = 200
      const fixed = await observe(false)
      const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'network', pageUrl,
        applicable: true, complete: fixed.complete, passed: true, assertions: fixed.assertions,
        execution: { auditId: 'after', taskId: 'network', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
      expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })?.assertion).toMatchObject({ complete: true, passed: true })
    } finally {
      for (const server of [entry, destination]) {
        server.closeAllConnections()
        await new Promise<void>(resolve => server.close(() => resolve()))
      }
    }
  }, 20_000)

  it('captures endpoint responses independently of ingestion using controlled transport', async () => {
    const context = await browser.newContext(); page = await context.newPage()
    const pageUrl = 'https://example.com/'
    bindAuditPageObservation(page, pageUrl, DESKTOP_CAPTURE_PROFILE, null, [])
    let status = 503, contentType = 'application/json', body = '{}'
    await page.route('**', route => route.fulfill(route.request().resourceType() === 'document'
      ? { status: 200, contentType: 'text/html', body: '<script>fetch("/_vercel/insights/view?cid=PRIVATE",{method:"POST",body:"PRIVATE_PAYLOAD"})</script>' }
      : { status, contentType, body }))
    async function observe() {
      const monitor = attachNetworkMonitor(page, pageUrl)
      try {
        await page.goto(pageUrl)
        await vi.waitFor(() => expect(monitor.tracking().requests).toMatchObject([{ role: 'event', status }]))
        const evidence = monitor.tracking(), result = runTrackingChecks(parseMetadataFromHtml('', pageUrl), evidence, pageUrl)
        expect(result.assertions.find(item => item.key === 'tracking-provider-recording')).toMatchObject({ complete: false })
        expect(JSON.stringify(evidence)).not.toContain('PRIVATE')
        return { ...result, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl,
          applicable: true, passed: result.flags.length === 0 && result.complete, complete: result.complete, assertions: result.assertions,
          execution: { auditId: 'after', taskId: 'event', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } }) }
      } finally { monitor.dispose() }
    }
    const [flag] = (await observe()).flags
    expect(flag).toMatchObject({ checkId: 'tracking-endpoint-http-error' })
    const proof = (receipt: Awaited<ReturnType<typeof observe>>['receipt']) => scopedAssertionForTarget({ receipt, flag, checkId: flag.checkId })
    status = 200; contentType = 'text/html'; body = '<title>Sign in</title>'
    const fallback = await observe()
    expect(fallback.assertions.find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: false, complete: false })
    expect(proof(fallback.receipt)).toBeUndefined()
    contentType = 'application/json'; body = '{}'
    const qualified = (await observe()).receipt
    expect(proof(qualified)?.assertion).toMatchObject({ passed: true, complete: true })
    const historical = { ...qualified, assertions: qualified.assertions.map(assertion => ({ ...assertion, eventResponseQualified: undefined })) }
    expect(proof(historical)).toBeUndefined()
    expect(readCheckReceipt(historical).assertions.find(item => item.key === 'tracking-http-response')).toMatchObject({ passed: false, complete: false })
    status = 206
    expect(proof((await observe()).receipt)).toBeUndefined()
    status = 204; contentType = 'text/html'; body = ''
    expect(proof((await observe()).receipt)?.assertion).toMatchObject({ passed: true, complete: true })
  })

  it('requires the original engagement redirect chain when two requests reach the same endpoint', async () => {
    let status = 503, intermediate = '/dispatch/PRIVATE_INTERMEDIATE'
    const server = createServer((request, response) => {
      if (request.url?.startsWith('/api/contact/start'))
        response.writeHead(302, { location: intermediate }).end()
      else if (request.url?.startsWith('/dispatch'))
        response.writeHead(302, { location: '/api/contact/result?token=PRIVATE_TARGET' }).end()
      else if (request.url?.startsWith('/api/contact/result'))
        response.writeHead(status, { 'content-type': 'application/json' }).end('{}')
      else response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><h1>Contact</h1>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const pageUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
    try {
      async function observe(path: string) {
        const session = await createAuditPage(browser, pageUrl, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false })
        page = session.page
        try {
          session.setTrackingPhase('public_action')
          session.setPublicActionControl('flow:control:' + 'a'.repeat(64))
          await page.evaluate(async path => { await (await fetch(path)).text() }, path)
          await session.settleNetwork(Date.now() + 2000, { engagement: 'public_action' })
          const observed = networkEngagementObservations({ pageUrl, failures: session.networkFailures, evidence: session.engagement() })
          expect(JSON.stringify(observed)).not.toContain('PRIVATE_')
          return { ...observed, receipt: checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'network', pageUrl,
            applicable: true, complete: observed.complete, passed: !observed.flags.length, assertions: observed.assertions,
            execution: { auditId: 'after', taskId: 'network', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } }) }
        } finally { session.disposeNetwork(); await page.context().close() }
      }
      const original = '/api/contact/start?source=PRIVATE_ORIGINAL'
      const [flag] = (await observe(original)).flags
      expect(flag).toMatchObject({ checkId: 'api-engagement-server-error', verificationRule: ENGAGEMENT_VERIFICATION_RULE })
      const proof = (receipt: Awaited<ReturnType<typeof observe>>['receipt']) => scopedAssertionForTarget({ receipt, flag, checkId: flag.checkId })
      status = 200
      expect(proof((await observe('/api/contact/start?source=PRIVATE_OTHER')).receipt)).toBeUndefined()
      expect(proof((await observe(intermediate)).receipt)).toBeUndefined()
      expect(proof((await observe('/api/contact/result?token=PRIVATE_TARGET')).receipt)).toBeUndefined()
      intermediate = '/dispatch/PRIVATE_REPLACEMENT'
      expect(proof((await observe(original)).receipt)).toBeUndefined()
      intermediate = '/dispatch/PRIVATE_INTERMEDIATE'
      expect(proof((await observe(original)).receipt)?.assertion).toMatchObject({ passed: true, complete: true })
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
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

  it('records the terminal library transfer and requires the same redirect destination for repair', async () => {
    let destination = '/assets/PRIVATE_ORIGINAL.js?token=PRIVATE_QUERY', status = 404
    let body: string | Buffer = 'window.libraryLoaded = true', compressed = false
    const intermediate = '/redirect?token=PRIVATE_INTERMEDIATE'
    const server = createServer((request, response) => {
      if (request.url === '/_vercel/insights/script.js') {
        response.writeHead(302, { location: intermediate }).end()
      } else if (request.url === intermediate) {
        response.writeHead(302, { location: destination, 'content-type': 'text/html' }).end('This is the redirect response.')
      } else if (request.url === destination) {
        response.writeHead(status, { 'content-type': 'application/javascript', 'transfer-encoding': 'chunked',
          ...(compressed ? { 'content-encoding': 'gzip' } : {}) }).end(body)
      } else {
        response.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><script src="/_vercel/insights/script.js"></script>')
      }
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`
    try {
      async function observe() {
        const session = await createAuditPage(browser, url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, settle: false })
        page = session.page
        try {
          await page.waitForLoadState('load')
          expect(session.tracking().requests).toMatchObject([{ role: 'library', redirected: true, status,
            state: status === 404 ? 'failed' : 'completed' }])
          const evidence = trackingEvidenceSchema.parse(session.tracking())
          const checked = runTrackingChecks(parseMetadataFromHtml(await page.content(), url), evidence, url)
          const receipt = checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'measurement', pageUrl: url,
            applicable: true, passed: checked.flags.length === 0 && checked.complete, complete: checked.complete, assertions: checked.assertions,
            execution: { auditId: 'after', taskId: 'library', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() } })
          expect(JSON.stringify([evidence, checked, session.technologyResources])).not.toContain('PRIVATE_')
          return { ...checked, receipt }
        } finally { session.disposeNetwork(); await page.context().close() }
      }
      const failed = await observe()
      const flag = failed.flags[0]
      expect(flag).toMatchObject({ checkId: 'tracking-library-http-error', evidence: expect.stringContaining('redirect destination') })
      status = 302
      const unresolved = await observe()
      expect(unresolved.complete).toBe(false)
      expect(scopedAssertionForTarget({ receipt: unresolved.receipt, checkId: flag.checkId!, flag })).toBeUndefined()
      status = 200
      for (const empty of ['', gzipSync('')]) {
        body = empty; compressed = typeof empty !== 'string'
        const incomplete = await observe()
        expect(incomplete.assertions.find(item => item.key === 'tracking-library')).toMatchObject({ complete: false, passed: false })
        expect(scopedAssertionForTarget({ receipt: incomplete.receipt, checkId: flag.checkId!, flag })).toBeUndefined()
      }
      body = gzipSync('window.libraryLoaded = true'); compressed = true
      destination = '/assets/PRIVATE_REPLACEMENT.js?token=PRIVATE_QUERY'
      const changed = await observe()
      expect(scopedAssertionForTarget({ receipt: changed.receipt, checkId: flag.checkId!, flag })).toBeUndefined()
      destination = '/assets/PRIVATE_ORIGINAL.js?token=PRIVATE_QUERY'
      const repaired = await observe()
      expect(scopedAssertionForTarget({ receipt: repaired.receipt, checkId: flag.checkId!, flag })?.assertion.passed).toBe(true)
    } finally {
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
