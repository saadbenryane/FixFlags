import { createServer } from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { createAuditPage } from '../../browser/page-session'
import { MOBILE_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { collectMobileNavigation } from '../mobile-navigation'
import { mobileNavigationFlags } from '../mobile-navigation-evidence'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native mobile navigation', () => {
  afterAll(closeBrowser)
  it.each([
    { label: 'restored child visibility', parent: 'visibility:hidden', panel: 'visibility:visible', visible: true },
    { label: 'ordinary visible navigation', parent: '', panel: '', visible: true },
    { label: 'inherited hidden visibility', parent: 'visibility:hidden', panel: '', visible: false },
    { label: 'transparent ancestor', parent: 'opacity:0', panel: 'opacity:1', visible: false },
    { label: 'display suppression', parent: 'display:none', panel: 'display:block', visible: false },
    { label: 'suppressed ancestor contents', parent: 'content-visibility:hidden', panel: '', visible: false },
  ])('$label agrees with actual rendered links', async scenario => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end('<!doctype html><title>Useful website service</title><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<header><button type="button" aria-controls="navigation" aria-expanded="false" onclick="const panel=document.getElementById(\'navigation\');panel.hidden=!panel.hidden;this.setAttribute(\'aria-expanded\',String(!panel.hidden))">Menu</button>' +
        '<div style="' + scenario.parent + '"><nav id="navigation" aria-label="Main" style="' + scenario.panel + '" hidden>' +
        Array.from({ length: 6 }, (_, i) => '<a href="/feature-' + i + '">Feature ' + i + '</a>').join(' ') +
        '</nav></div></header><main><h1>Useful service for teams</h1><p>Choose public information for your team.</p></main>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    try {
      const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
      const session = await createAuditPage(await getAuditBrowser(), url, { profile: MOBILE_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, deadline: Date.now() + 12_000 })
      try {
        await session.page.getByRole('button', { name: 'Menu', exact: true }).tap()
        const native = await session.page.locator('#navigation a').first().evaluate(element => {
          const rect = element.getBoundingClientRect()
          return element.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
            element.contains(document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2))
        })
        expect(native).toBe(scenario.visible)
        await session.page.getByRole('button', { name: 'Menu', exact: true }).tap()
        const observed = await collectMobileNavigation(session.page, Date.now() + 6000)
        expect(observed.complete).toBe(true)
        expect(observed.observations[0].opened).toBe(scenario.visible)
        expect(mobileNavigationFlags(observed.observations, url)).toHaveLength(scenario.visible ? 0 : 1)
      } finally { session.disposeNetwork(); await session.page.context().close() }
    } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())) }
  })
  it('observes missing and failed openers, working portals, compact navigation and refused mutations', async () => {
    let mode = 'missing', submissions = 0
    const links = Array.from({ length: 6 }, (_, index) => `<a href="/feature-${index}?token=PRIVATE_NAVIGATION_VALUE">Feature ${index}</a>`).join('')
    const server = createServer((request, response) => {
      if (request.url === '/newsletter') { submissions++; response.end('Accepted'); return }
      response.setHeader('content-type', 'text/html')
      const button = mode === 'missing' || mode === 'compact' ? '' : '<button type="button" id="opener" aria-label="Menu" aria-expanded="false"' +
        (mode === 'unbound' || mode === 'unbound-lazy' ? '' : ' aria-controls="navigation"') + '>Menu</button>'
      const panel = mode === 'lazy' || mode === 'unmounted' || mode === 'unbound-lazy' ? '' : mode === 'compact' ? '<nav id="navigation" aria-label="Main"><a href="/one">One</a><a href="/two">Two</a></nav>'
        : '<' + (mode === 'portal' ? 'div' : 'nav') + ' id="navigation" aria-label="Main" hidden>' + links + '</' + (mode === 'portal' ? 'div' : 'nav') + '>'
      response.end('<html><head><title>Useful website service</title><meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body><header>' + button + (mode === 'portal' ? '' : panel) + '</header>' + (mode === 'portal' ? panel : '') +
        '<main><h1>Useful service for teams</h1><p>Review useful public information and choose the feature you need.</p></main>' +
        '<script>document.getElementById("opener")?.addEventListener(' + JSON.stringify(mode === 'touch-only' ? 'touchstart' : 'click') + ',()=>{' +
        (mode === 'mutation' ? 'fetch("/newsletter",{method:"POST",body:"probe"});' : '') +
        (mode === 'lazy' ? 'let panel=document.getElementById("navigation");if(!panel){panel=document.createElement("div");panel.id="navigation";panel.innerHTML=' + JSON.stringify(links) + ';document.body.append(panel)}else{panel.hidden=!panel.hidden}document.getElementById("opener").setAttribute("aria-expanded",String(!panel.hidden));' : '') +
        (mode === 'healthy' || mode === 'portal' || mode === 'mutation' || mode === 'touch-only' ? 'const p=document.getElementById("navigation");p.hidden=!p.hidden;document.getElementById("opener").setAttribute("aria-expanded",String(!p.hidden));' : '') +
        '})</script></body></html>')
    })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    try {
      for (const phase of ['missing', 'noop', 'unmounted', 'healthy', 'touch-only', 'portal', 'lazy', 'compact', 'unbound', 'unbound-lazy', 'mutation']) {
        mode = phase
        const session = await createAuditPage(await getAuditBrowser(), url, { profile: MOBILE_CAPTURE_PROFILE, allowLocalhost: true, journeySafe: true, deadline: Date.now() + 10_000 })
        try {
          const observed = await collectMobileNavigation(session.page, Date.now() + 6000, { refusalCount: () => session.safetyRestrictions.length })
          const flags = mobileNavigationFlags(observed.observations, url)
          expect(observed.applicable, phase).toBe(true)
          if (phase === 'missing' || phase === 'noop' || phase === 'unmounted') expect(flags, phase).toHaveLength(1)
          else expect(flags, phase).toEqual([])
          expect(observed.complete, phase).toBe(!['unbound', 'unbound-lazy', 'mutation'].includes(phase))
          if (['healthy', 'touch-only', 'portal', 'lazy', 'compact'].includes(phase)) expect(observed.observations[0].opened, phase).toBe(true)
          expect(await session.page.evaluate(() => navigator.maxTouchPoints > 0)).toBe(true)
          expect(JSON.stringify(observed), phase).not.toContain('PRIVATE_NAVIGATION_VALUE')
        } finally { session.disposeNetwork(); await session.page.context().close() }
      }
      expect(submissions).toBe(0)
    } finally {
      server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }, 35_000)
})
