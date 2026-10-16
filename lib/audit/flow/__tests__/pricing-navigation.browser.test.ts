import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { probePricingNav } from '../nav-probes'
import { bindAuditPageObservation } from '../../browser/observation-scope'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { runFlowChecks } from '../../checks/flow'
import { pricingNavigationAssertions, PRICING_NAVIGATION_RULE } from '../pricing-navigation-evidence'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native pricing navigation', () => {
  afterAll(closeBrowser)
  it('uses the visible link when a hidden mobile navigation appears first', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      page.setDefaultTimeout(600)
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Planning</title><header><nav hidden><a href="#missing">Pricing</a></nav><nav><a href="#plans">Pricing</a></nav></header><main><h1>Useful project planning</h1><section id="plans" style="margin-top:1600px;height:300px"><h2>Plans for your team</h2></section></main>' }))
      await page.goto('https://example.com/')
      bindAuditPageObservation(page, page.url(), DESKTOP_CAPTURE_PROFILE, null, [])
      expect(await probePricingNav(page)).toMatchObject({ pricingNav: 'ok', pricingNavHref: '#plans' })
    } finally { await context.close() }
  })
  it('keeps a challenge on the declared pricing route inconclusive', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: route.request().url().endsWith('/pricing')
        ? '<!doctype html><title>Just a moment...</title><h1>Verify you are human</h1>'
        : '<!doctype html><title>Planning</title><header><nav><a href="/pricing">Pricing</a></nav></header><main><h1>Useful planning service</h1></main>' }))
      await page.goto('https://example.com/')
      bindAuditPageObservation(page, page.url(), DESKTOP_CAPTURE_PROFILE, null, [])
      expect(await probePricingNav(page)).toMatchObject({ pricingNav: 'skipped' })
    } finally { await context.close() }
  })
  it.each([
    { label: 'absent navigation', link: '<a href="/features">Features</a>', expected: 'skipped' },
    { label: 'missing section', link: '<a id="pricing" href="#plans">Pricing</a>', expected: 'broken' },
    { label: 'hidden section', link: '<a id="pricing" href="#plans">Pricing</a>', section: '<section id="plans" hidden>Plans</section>', expected: 'broken' },
    { label: 'encoded section', link: '<a id="pricing" href="#plans%3Apro">Pricing</a>', section: '<section id="plans:pro" style="margin-top:1800px;height:200px">Plans</section>', expected: 'ok' },
    { label: 'disabled control', link: '<a id="pricing" aria-disabled="true" href="/pricing">Pricing</a>', expected: 'broken' },
    { label: 'successful page', link: '<a id="pricing" href="/pricing">Pricing</a>', expected: 'ok' },
    { label: 'localized page', link: '<a id="pricing" href="/offres">Pricing</a>', heading: 'Nos offres', expected: 'ok' },
    { label: 'HTTP failure', link: '<a id="pricing" href="/pricing">Pricing</a>', status: 503, expected: 'broken' },
    { label: 'access restriction', link: '<a id="pricing" href="/pricing">Pricing</a>', status: 403, expected: 'skipped' },
    { label: 'blank page', link: '<a id="pricing" href="/pricing">Pricing</a>', blank: true, expected: 'skipped' },
    { label: 'hidden challenge template', link: '<a id="pricing" href="/pricing">Pricing</a>', hiddenChallenge: true, expected: 'ok' },
    { label: 'rendered SPA route', link: '<a id="pricing" href="/pricing" onclick="event.preventDefault();history.pushState({},\'\',this.href);document.querySelector(\'h1\').textContent=\'Plans for your team\'">Pricing</a>', expected: 'ok' },
    { label: 'unexpected redirect', link: '<a id="pricing" href="/pricing">Pricing</a>', redirect: true, expected: 'skipped' },
    { label: 'no advancement', link: '<a id="pricing" href="/pricing" onclick="event.preventDefault()">Pricing</a>', expected: 'broken' },
    { label: 'pending navigation', link: '<a id="pricing" href="/pricing">Pricing</a>', pending: true, expected: 'skipped' },
    { label: 'separate tab', link: '<a id="pricing" target="_blank" href="/pricing">Pricing</a>', separateTab: true, expected: 'skipped' },
    { label: 'inherited separate tab', link: '<a id="pricing" href="/pricing">Pricing</a>', base: true, separateTab: true, expected: 'skipped' },
  ])('$label retains an honest navigation result', async scenario => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => {
        const path = new URL(route.request().url()).pathname
        if (path === '/') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Planning</title>' + (scenario.base ? '<base target="_blank">' : '') + '<header><nav>' + scenario.link + '</nav></header><main><h1>Useful project planning</h1>' + (scenario.section ?? '') + '</main>' })
        if (scenario.pending) return
        if (scenario.redirect && path === '/pricing') return route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Planning</title><script>location.replace("/home")</script>' })
        return route.fulfill({ status: scenario.status ?? 200, contentType: 'text/html', body: scenario.blank ? '<!doctype html><title>Planning</title><main></main>'
          : '<!doctype html><title>Planning</title><main>' + (scenario.hiddenChallenge ? '<h1 hidden>Verify you are human</h1>' : '') + '<h1>' + (scenario.heading ?? (scenario.redirect ? 'Welcome to our service' : 'Plans for your team')) + '</h1><p>Useful information for your whole team.</p></main>' })
      })
      await page.goto('https://example.com/')
      bindAuditPageObservation(page, page.url(), DESKTOP_CAPTURE_PROFILE, null, [])
      const observed = await probePricingNav(page)
      expect(observed, JSON.stringify({ observed, pageUrl: page.url() })).toMatchObject({ pricingNav: scenario.expected })
      if (scenario.separateTab) expect(context.pages()).toHaveLength(1)
      if (scenario.expected === 'broken') {
        const flags = runFlowChecks({ status: 'skipped', steps: [{ label: 'Landing', screenshotUrl: null, url: 'https://example.com/' }], finalUrl: page.url(),
          multiStep: { ...observed, mobileMenu: 'skipped', formValidation: 'skipped' } })
        expect(flags.find(flag => flag.checkId === 'flow-pricing-nav-broken')).toMatchObject({ verificationRule: PRICING_NAVIGATION_RULE,
          evidenceTargets: [{ context: observed.pricingEvidence?.context }] })
      }
    } finally { await context.close() }
  }, 15_000)
  it('rechecks the original control and preserves unknown scope when it changes or disappears', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><title>Planning</title><header><nav><a id="pricing" href="#plans">Pricing</a></nav></header><main><h1>Useful planning service</h1></main>' }))
      await page.goto('https://example.com/')
      bindAuditPageObservation(page, page.url(), DESKTOP_CAPTURE_PROFILE, null, [])
      const source = await probePricingNav(page), expected = [source.pricingEvidence!.context]
      expect(source.pricingEvidence).toMatchObject({ complete: true, passed: false })
      await page.evaluate(() => { history.replaceState({}, '', '/'); document.querySelector('main')!.insertAdjacentHTML('beforeend', '<section id="plans" style="height:300px">Plans for your team</section>') })
      const repaired = await probePricingNav(page, undefined, expected)
      expect(pricingNavigationAssertions(repaired.pricingEvidence)[0]).toMatchObject({ passed: true, complete: true, context: expected[0] })
      await page.evaluate(() => { history.replaceState({}, '', '/'); document.querySelector('#pricing')!.setAttribute('href', '#other') })
      expect((await probePricingNav(page, undefined, expected)).pricingEvidence).toMatchObject({ complete: false, reason: 'original-missing' })
      await page.evaluate(() => { document.querySelector('#pricing')!.remove(); document.querySelector('nav')!.innerHTML = '<a id="other-link" href="#plans">Pricing</a>' })
      expect((await probePricingNav(page, undefined, expected)).pricingEvidence).toMatchObject({ complete: false, reason: 'original-missing' })
    } finally { await context.close() }
  })
})
