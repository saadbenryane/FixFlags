import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { runFlowScan } from '../run-flow-scan'
import { measurePostClickLoading } from '../post-click-probes'
import { runDestinationUXProbes } from '../destination-ux-probes'
import { runFlowChecks } from '../../checks/flow'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native post-click loading observations', () => {
  afterAll(closeBrowser)
  it('includes a delayed document response without labeling the prior page as a blank screen', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', async route => {
        const landing = route.request().url().endsWith('/start')
        if (!landing) await new Promise(resolve => setTimeout(resolve, 3300))
        await route.fulfill({ contentType: 'text/html', body: landing
          ? '<!doctype html><main><h1>Useful project planning</h1><a href="/signup">Get started</a></main>'
          : '<!doctype html><title>Useful team planning</title><main><h1>Start using our useful service</h1><p>Plan projects with your whole team.</p><button>Continue</button></main>' })
      })
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'slow-response-fixture', page.url(), {
        captureSteps: false, includeFormValidation: false, includeMobileNavigation: false,
      })
      expect(result.status).toBe('success')
      expect(result.postClickMetrics?.timeToFirstContentMs).toBeGreaterThan(3000)
      expect(result.postClickMetrics?.contentAbsentThroughMs).toBeGreaterThan(3000)
      expect(result.postClickMetrics?.blankScreenMs).toBeLessThan(500)
      expect(runFlowChecks(result).map(flag => flag.checkId)).toContain('flow-cta-blank-destination')
    } finally { await context.close() }
  }, 15_000)
  it('does not treat a late SPA URL change as proof that its content was delayed', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><main><h1>Useful project planning</h1><a id="start" href="/signup">Get started</a></main><script>' +
        'document.getElementById("start").onclick=event=>{event.preventDefault();document.querySelector("main").innerHTML="<h1>Start using our useful service</h1><p>Plan projects with your whole team.</p><button>Continue</button>";setTimeout(()=>history.pushState({},"","/signup"),3300)};</script>' }))
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'spa-post-click-fixture', page.url(), {
        captureSteps: false, includeFormValidation: false, includeMobileNavigation: false,
      })
      expect(result.status).toBe('success')
      expect(result.postClickMetrics?.contentComplete).toBe(false)
      expect(runFlowChecks(result).map(flag => flag.checkId)).not.toContain('flow-cta-blank-destination')
      expect(runFlowChecks(result).map(flag => flag.checkId)).not.toContain('flow-destination-slow-load')
    } finally { await context.close() }
  }, 15_000)
  it('keeps observed content usable while a deferred script has not completed', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => {
        if (route.request().resourceType() === 'script') return
        return route.fulfill({ contentType: 'text/html', body: route.request().url().endsWith('/start')
          ? '<!doctype html><main><h1>Useful project planning</h1><a href="/signup">Get started</a></main>'
          : '<!doctype html><title>Useful team planning</title><script defer src="/pending.js"></script><main><h1>Start using our useful service</h1><p>Plan projects with your whole team.</p></main>' })
      })
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'post-click-content-fixture', page.url(), {
        captureSteps: false, includeFormValidation: false, includeMobileNavigation: false,
      })
      expect(result.status).toBe('success')
      expect(result.postClickMetrics?.timeToFirstContentMs).toBeLessThan(1500)
      expect(await page.evaluate(() => document.readyState)).toBe('interactive')
      expect(result.destinationUX).toMatchObject({ contentComplete: false, controlsComplete: false })
      expect(runFlowChecks(result).map(flag => flag.checkId)).not.toContain('flow-destination-no-cta')
    } finally { await context.close() }
  }, 15_000)

  it('keeps destination declarations incomplete while HTML is still being parsed', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.evaluate(() => { document.open(); document.write('<main><h1>Useful team planning</h1><p>Choose the next step for your team.</p>') })
      expect(await page.evaluate(() => document.readyState)).toBe('loading')
      expect(await runDestinationUXProbes(page, 'Get started', '/signup')).toMatchObject({
        contentComplete: false, controlsComplete: false, trustSignals: { hasPrivacyPolicy: null, hasContactInfo: null },
      })
    } finally { await context.close() }
  })
  it('observes destination delay while navigation still waits for deferred JavaScript', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', async route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/late.js') {
          await new Promise(resolve => setTimeout(resolve, 3300))
          await route.fulfill({ contentType: 'application/javascript', body: 'document.querySelector("main").innerHTML="<h1>Start using our useful service</h1><p>Plan projects with your whole team.</p><button>Continue</button>"' })
        } else await route.fulfill({ contentType: 'text/html', body: path === '/start'
          ? '<!doctype html><main><h1>Useful project planning</h1><a href="/signup">Get started</a></main>'
          : '<!doctype html><title>Team planning</title><script defer src="/late.js"></script><main><div class="spinner" style="width:200px;height:200px">Loading account</div></main>' })
      })
      await page.goto('https://example.com/start')
      const result = await runFlowScan(page, 'post-click-timing-fixture', page.url(), {
        captureSteps: false, includeFormValidation: false, includeMobileNavigation: false,
      })
      expect(result.status).toBe('success')
      expect(result.postClickMetrics?.timeToFirstContentMs).toBeGreaterThan(3000)
      expect(result.postClickMetrics?.stuckLoading).toBe(true)
      expect(result.destinationUX?.loadQuality.timeToContentMs).toBe(result.postClickMetrics?.timeToFirstContentMs)
    } finally { await context.close() }
  }, 15_000)

  it('recognizes decoded viewport content without waiting for offscreen or hidden loading UI', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><img width="100" height="100" src="data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22%3E%3Crect width=%22100%22 height=%22100%22 fill=%22blue%22/%3E%3C/svg%3E">' +
        '<div style="opacity:0"><div class="spinner" style="width:100px;height:100px">Loading</div></div><div class="spinner" style="position:absolute;top:1800px;width:100px;height:100px">Loading</div></main>')
      const metrics = await measurePostClickLoading(page, 200)
      expect(metrics.timeToFirstContentMs).not.toBeNull()
      expect(metrics.timeToFirstContentMs).toBeLessThan(150)
      expect(metrics.stuckLoading).toBe(false)
    } finally { await context.close() }
  })

  it('does not turn hidden prose or an incomplete graphics observation into a content-arrival time', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><div style="opacity:0">This long hidden template is not useful visible content.</div><canvas width="100" height="100"></canvas></main>')
      const metrics = await measurePostClickLoading(page, 200)
      expect(metrics.timeToFirstContentMs).toBeNull()
      expect(metrics.blankScreenMs).toBeNull()
      expect(metrics.contentComplete).toBe(false)
    } finally { await context.close() }
  })

  it('keeps a newly appearing loader incomplete when the observation ends before its duration is known', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><div id="loader" hidden class="spinner" style="width:200px;height:200px">Loading account</div></main><script>setTimeout(()=>document.getElementById("loader").hidden=false,80)</script>')
      const metrics = await measurePostClickLoading(page, 350)
      expect(metrics.timeToFirstContentMs).toBeNull()
      expect(metrics.stuckLoading).toBeNull()
      expect(metrics.loadingComplete).toBe(false)
    } finally { await context.close() }
  })
})
