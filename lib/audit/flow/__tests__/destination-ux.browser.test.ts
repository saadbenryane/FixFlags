import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { createAuditPage } from '../../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { runDestinationUXProbes } from '../destination-ux-probes'
import { runFlowUXChecks } from '../../checks/flow-ux'
import { runFlowChecks } from '../../checks/flow'
import { assembleFlowModuleCheck } from '../../checks/flow-module-receipt'
import type { FlowScanResult } from '../run-flow-scan'
import { runFlowScan } from '../run-flow-scan'
import { primaryActionAssertions, primaryActionResponseDestinationKey } from '../primary-action-evidence'
import * as screenshotStorage from '@/lib/storage/screenshots'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native destination observations', () => {
  afterAll(closeBrowser)
  afterEach(() => vi.unstubAllGlobals())
  it('records the actual HTTP redirect destination for the original public Checkout link', async () => {
    const methods: string[] = []
    const server = createServer((request, response) => {
      methods.push(request.method ?? '')
      if (request.url === '/checkout') {
        response.writeHead(302, { location: '/checkout/alternate' }).end()
        return
      }
      response.setHeader('content-type', 'text/html')
      response.end(request.url === '/start'
        ? '<!doctype html><main><h1>Review your shopping cart</h1><a href="/checkout">Checkout</a></main>'
        : '<!doctype html><title>Checkout</title><main><h1>Checkout</h1><p>Review the items in your cart.</p></main>')
    })
    await new Promise<void>((resolve, reject) => server.once('error', reject).listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Checkout fixture did not bind a port')
    const origin = 'http://127.0.0.1:' + address.port
    try {
      const session = await createAuditPage(await getAuditBrowser(), origin + '/start', {
        profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, deadline: Date.now() + 15_000,
      })
      try {
        const result = await runFlowScan(session.page, 'redirected-checkout-fixture', origin + '/start', {
          mode: 'primary', captureSteps: false,
        })
        expect(result).toMatchObject({ status: 'success', finalUrl: origin + '/checkout/alternate', actionEvidence: {
          clicked: true, response: 'healthy', httpStatus: 200,
          responseDestinationKey: primaryActionResponseDestinationKey(origin + '/checkout/alternate'),
        } })
        expect(methods.every(method => method === 'GET')).toBe(true)
      } finally { session.disposeNetwork(); await session.page.context().close() }
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
  }, 20_000)
  it.each([false, true])('retains a known failed navigation while the error document keeps loading (capture %s)', async captureSteps => {
    const upload = vi.spyOn(screenshotStorage, 'uploadScreenshot').mockResolvedValue('https://fixture.invalid/landing.png')
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => {
        if (route.request().resourceType() === 'font') return
        return route.fulfill({ status: route.request().url().endsWith('/start') ? 200 : 404,
        contentType: 'text/html', body: route.request().url().endsWith('/start')
          ? '<!doctype html><main><h1>Useful project planning service</h1><a href="/signup">Get started</a></main>'
          : '<!doctype html><title>Page unavailable</title><style>@font-face{font-family:Pending;src:url(/delayed-font.woff)}h1{font-family:Pending}</style><main><h1>Page unavailable</h1><div class="spinner" style="width:200px;height:200px">Loading account</div></main>' })
      })
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'failed-destination-fixture', page.url(), {
        captureSteps, includeFormValidation: false, includeMobileNavigation: false, deadlineMs: 6000,
      })
      expect(result).toMatchObject({ status: 'error_response', httpStatus: 404, finalUrl: 'https://example.com/signup',
        actionEvidence: { clicked: true, navigation: 'changed', response: 'error', httpStatus: 404 } })
      expect(result.steps.at(-1)).toMatchObject({ label: 'After click', screenshotUrl: null })
    } finally { await context.close(); upload.mockRestore() }
  }, 10_000)

  it('distinguishes hidden challenge copy from an actual rendered challenge after navigation', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      for (const challenged of [false, true]) {
        await page.route('**', route => route.fulfill({ contentType: 'text/html', body: route.request().url().endsWith('/start')
          ? '<!doctype html><main><h1>Useful project planning service</h1><a href="/signup">Get started</a></main>'
          : '<!doctype html><title>Useful service</title><main><h1' + (challenged ? '' : ' hidden') + '>Verify you are human</h1><h1>Start using our useful service</h1><p>Choose a plan for your whole team.</p></main>' }))
        await page.goto('https://example.com/start')
        const result = await runFlowScan(page, 'challenge-destination-fixture', page.url(), {
          mode: 'primary', captureSteps: false,
        })
        expect(result, String(challenged)).toMatchObject({ status: challenged ? 'skipped' : 'success',
          actionEvidence: { response: challenged ? 'challenge' : 'healthy' } })
        await page.unroute('**')
      }
    } finally { await context.close() }
  })
  it.each([
    ['blank', '<main></main>'],
    ['loading', '<main><div aria-busy="true">Loading your account</div></main>'],
    ['missing page', '<main><h1>Page not found</h1><p>Check the address and try again.</p></main>'],
  ])('keeps a %s HTTP 200 destination inconclusive for repair', async (_scenario, body) => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: route.request().url().endsWith('/start')
        ? '<!doctype html><main><h1>Useful project planning service</h1><a href="/signup">Get started</a></main>'
        : '<!doctype html><title>Team signup</title>' + body }))
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'incomplete-destination-fixture', page.url(), { mode: 'primary', captureSteps: false })
      expect(result.actionEvidence).toMatchObject({ clicked: true, httpStatus: 200 })
      const assertions = primaryActionAssertions(result.actionEvidence)
      for (const key of ['primary-action-response', 'primary-action-navigation'])
        expect(assertions.find(assertion => assertion.key === key)).toMatchObject({ complete: false, passed: false })
    } finally { await context.close() }
  })
  it('reuses reached-document evidence through the full flow runner', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      const documents: string[] = []
      await page.route('**', route => {
        documents.push(new URL(route.request().url()).pathname)
        return route.fulfill({ contentType: 'text/html', body: route.request().url().endsWith('/start')
          ? '<!doctype html><main><h1>Plan projects with your team</h1><a href="/signup">Get started</a></main>'
          : '<!doctype html><title>Team planning</title><main><h1 hidden>Retired promise</h1><h1>Subscribe to team planning</h1><p>Organize useful projects and keep your team informed.</p><button>Continue</button><a href="/privacy">Privacy policy</a><a href="mailto:help@example.com">Contact support</a></main>' })
      })
      await page.goto('https://example.com/start')
      const requests = vi.fn(async () => { throw new Error('Duplicate destination request') })
      vi.stubGlobal('fetch', requests)
      const result = await runFlowScan(page, 'destination-fixture', page.url(), {
        captureSteps: false, includeFormValidation: false, includeMobileNavigation: false,
      })
      expect(result).toMatchObject({ status: 'success', finalUrl: 'https://example.com/signup',
        destinationUX: { contentComplete: true, controlsComplete: true, headline: 'Subscribe to team planning', ctaText: 'Continue' },
        destinationTrust: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true } })
      expect(result.destinationUX?.loadQuality.timeToContentMs).toBe(result.postClickMetrics?.timeToFirstContentMs)
      expect(documents).toEqual(['/start', '/signup'])
      expect(requests).not.toHaveBeenCalled()
    } finally { await context.close() }
  })
  it('keeps a rendered missing-page template out of destination content and trust conclusions', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: route.request().url().endsWith('/start')
        ? '<!doctype html><main><h1>Useful project planning service</h1><a href="/signup">Get started</a></main>'
        : '<!doctype html><title>Page not found</title><main><h1>Page not found</h1><p>The requested page could not be located.</p></main>' }))
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'unavailable-destination-content', page.url(), { mode: 'destination', captureSteps: false })
      const flags = runFlowChecks(result)
      const { assertions } = assembleFlowModuleCheck({ result, actionRequired: true, actionFlags: flags, pricingOnly: false, targetedPricing: false })
      const keys = ['destination-headline', 'destination-next-action', 'destination-promise', 'destination-action-count',
        'destination-form-privacy', 'destination-trust', 'destination-content-timing', 'destination-loading-ui']
      expect(assertions).toEqual(expect.arrayContaining(keys.map(key =>
        expect.objectContaining({ key, complete: false, passed: false }))))
      expect(flags.map(flag => flag.checkId)).not.toContain('flow-destination-no-cta')
      expect(flags.map(flag => flag.checkId)).not.toContain('flow-cta-destination-no-trust')
      expect(result.postClickMetrics?.timeToFirstContentMs).not.toBeNull()
    } finally { await context.close() }
  })
  it('uses the rendered headline, enabled controls and native trust signals without another HTTP request', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><head><title>Team signup</title><meta name="viewport" content="width=device-width"></head>' +
        '<body><main><h1 hidden>Retired product promises</h1><h1>Subscribe to team planning</h1><p>Start planning useful projects with your whole team today.</p>' +
        '<div style="opacity:0"><button>Get started</button><button>Buy now</button><button>Subscribe</button><button>Request demo</button><button>Upgrade</button><button>Checkout</button></div>' +
        '<button disabled>Start now</button><button>Continue</button><form><input type="email"></form><footer><a href="/privacy">Privacy policy</a><a href="mailto:help@example.com">Contact support</a></footer></main></body>' }))
      await page.goto('https://example.com/signup')
      const requests = vi.fn(async () => { throw new Error('No second document fetch is available') })
      vi.stubGlobal('fetch', requests)
      const result = await runDestinationUXProbes(page, 'Subscribe', '/subscribe', {
        timeToFirstContentMs: 4200, blankScreenMs: 4200, stuckLoading: true, stuckLoadingLabel: 'Recorded loading UI',
      })
      expect(result.headline).toBe('Subscribe to team planning')
      expect(result.ctaPromisesMatch).toBe(true)
      expect(result.trustSignals).toMatchObject({ hasPrivacyPolicy: true, hasContactInfo: true })
      expect(result.frictionSignals.tooManyCTAs).toBe(false)
      expect(result.ctaText).toBe('Continue')
      expect(requests).not.toHaveBeenCalled()
      expect(result.loadQuality).toEqual({ timeToContentMs: 4200, hadStuckLoading: true, layoutShift: null })
    } finally { await context.close() }
  })

  it('keeps unavailable copy and declarations unknown while retaining independent control observations', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Large destination</title><main>' +
        '<p>' + 'x'.repeat(1_000_001) + '</p><button>Continue</button><form><input type="email"></form></main>' }))
      await page.goto('https://example.com/signup')
      const ux = await runDestinationUXProbes(page, 'Subscribe', '/subscribe')
      expect(ux).toMatchObject({ contentComplete: false, controlsComplete: true, hasPrimaryCTA: true,
        trustSignals: { hasPrivacyPolicy: false, hasContactInfo: null, isHttps: true },
        loadQuality: { timeToContentMs: null, hadStuckLoading: null, layoutShift: null } })
      const flags = runFlowUXChecks({ status: 'success', ctaText: 'Subscribe', finalUrl: page.url(), destinationUX: ux } as FlowScanResult)
      expect(flags.map(flag => flag.checkId)).toEqual(['flow-destination-no-privacy'])
    } finally { await context.close() }
  })

  it('reads privacy and contact from the open document when saved HTML is too large', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Large destination</title><main>' +
        '<h1>Subscribe to team planning</h1><p>' + 'x'.repeat(1_000_001) + '</p><a href="/privacy">Privacy policy</a><a href="mailto:help@example.com">Email support</a></main>' }))
      await page.goto('https://example.com/signup')
      const ux = await runDestinationUXProbes(page, 'Subscribe', '/subscribe')
      expect(ux.trustSignals).toEqual({ hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true })
      expect(runFlowUXChecks({ status: 'success', ctaText: 'Subscribe', finalUrl: page.url(), destinationUX: ux } as FlowScanResult)).toEqual([])
    } finally { await context.close() }
  })
})
