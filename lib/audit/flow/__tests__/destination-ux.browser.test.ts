import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { runDestinationUXProbes } from '../destination-ux-probes'
import { runFlowUXChecks } from '../../checks/flow-ux'
import type { FlowScanResult } from '../run-flow-scan'
import { runFlowScan } from '../run-flow-scan'
import * as screenshotStorage from '@/lib/storage/screenshots'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native destination observations', () => {
  afterAll(closeBrowser)
  afterEach(() => vi.unstubAllGlobals())
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
  it('uses the rendered headline, enabled controls and loaded metadata without another HTTP request', async () => {
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
        trustSignals: { hasPrivacyPolicy: null, hasContactInfo: null, isHttps: true },
        loadQuality: { timeToContentMs: null, hadStuckLoading: null, layoutShift: null } })
      const flags = runFlowUXChecks({ status: 'success', ctaText: 'Subscribe', finalUrl: page.url(), destinationUX: ux } as FlowScanResult)
      expect(flags).toEqual([])
    } finally { await context.close() }
  })
})
