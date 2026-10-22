import { createServer } from 'node:http'
import { afterAll, describe, expect, it, vi } from 'vitest'
import type { Page } from 'playwright'
import { closeBrowser, getAuditBrowser } from '../screenshot'
import { createAuditPage } from '../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../browser/capture-profile'
import { actionPanelOpened, visibleActionPanels } from './action-panels'
import { runFlowScan } from './run-flow-scan'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native same-page action panels', () => {
  afterAll(closeBrowser)
  async function inspect(html: string, operation: (page: Page) => Promise<void>) {
    const server = createServer((_request, response) => { response.setHeader('content-type', 'text/html'); response.end(html) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      const session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, deadline: Date.now() + 10_000 })
      try { await operation(session.page) }
      finally { session.disposeNetwork(); await session.page.context().close() }
    } finally { vi.unstubAllEnvs(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  }

  it('observes a new undeclared signup dialog and preserves its identity across field-value changes', async () => {
    await inspect('<!doctype html><html><body><button id="start">Get started</button>' +
      '<div id="dialog" role="dialog" hidden><h2>Create your account</h2><form id="signup"><label>Email<input id="email" value="PRIVATE_INITIAL"></label><button>Continue</button></form></div>' +
      '<script>start.onclick=()=>document.getElementById("dialog").hidden=false</script></body></html>', async page => {
      const before = await visibleActionPanels(page)
      expect(before).toEqual([])
      await page.locator('#start').click()
      const after = await visibleActionPanels(page)
      expect(actionPanelOpened(before, after)).toBe(true)
      expect(after?.every(panel => /^[a-f0-9]{64}$/.test(panel.key))).toBe(true)
      await page.locator('#email').fill('PRIVATE_CHANGED')
      expect(await visibleActionPanels(page)).toEqual(after)
    })
  })

  it('does not confuse existing form rerenders or placement changes with a newly opened next step', async () => {
    await inspect('<!doctype html><html><body><main><form id="signup"><h2>Create your account</h2><input type="email"><button>Continue</button></form></main><aside></aside></body></html>', async page => {
      const before = await visibleActionPanels(page)
      expect(before?.length).toBe(1)
      await page.locator('h2').evaluate(element => { element.textContent = 'Changed heading' })
      expect(actionPanelOpened(before, await visibleActionPanels(page))).toBeNull()
      await page.evaluate(() => {
        const form = document.getElementById('signup')!
        document.querySelector('aside')!.append(form.cloneNode(true)); form.remove()
      })
      expect(actionPanelOpened(before, await visibleActionPanels(page))).toBeNull()
    })
  })
  it('observes a declared next-step panel that restores inherited visibility', async () => {
    await inspect('<!doctype html><html><body><main><h1>Plan useful projects with your team</h1><p>Choose the next step for your project.</p>' +
      '<button id="start" aria-controls="next">Get started</button><div style="visibility:hidden"><section id="next" style="visibility:visible" hidden><h2>Choose a project</h2><a href="#choice">Continue</a></section></div>' +
      '<script>start.onclick=()=>document.getElementById("next").hidden=false</script></main></body></html>', async page => {
      await page.locator('#start').click()
      expect(await page.locator('#next').evaluate(element => element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))).toBe(true)
      await page.locator('#next').evaluate(element => { (element as HTMLElement).hidden = true })
      const result = await runFlowScan(page, 'native-panel-visibility', page.url(), { mode: 'primary', captureSteps: false, deadlineMs: 8000 })
      expect(result.actionEvidence).toMatchObject({ clicked: true, navigation: 'changed', samePageProgress: 'declared-panel' })
    })
  })

  it('excludes status text, hidden, transparent, offscreen, disabled and dismissal-only panels', async () => {
    await inspect('<!doctype html><html><body><div role="status">Please wait</div>' +
      '<form hidden><input></form><div style="opacity:0"><form><input></form></div>' +
      '<form style="position:fixed;left:-300px"><input></form><form><input disabled><button disabled>Continue</button></form>' +
      '<div role="dialog"><button>Close</button></div><form inert><input></form></body></html>', async page => {
      const before = await visibleActionPanels(page)
      await page.getByRole('status').evaluate(element => { element.textContent = 'Changed status' })
      expect(before?.filter(panel => panel.actionable)).toEqual([])
      expect(actionPanelOpened(before, await visibleActionPanels(page))).toBe(false)
    })
  })

  it('keeps an unavailable panel observation unknown', async () => {
    const page = { evaluate: vi.fn().mockRejectedValue(new Error('Observation unavailable')) } as unknown as Page
    expect(await visibleActionPanels(page)).toBeNull()
    expect(actionPanelOpened([], null)).toBeNull()
    expect(actionPanelOpened(null, [{ key: 'observed', nodeKey: 'node', fingerprint: 'state', actionable: true }])).toBeNull()
    expect(actionPanelOpened([], [{ key: 'unresolved-dialog', nodeKey: 'node', fingerprint: 'state', actionable: false }])).toBeNull()
  })
})
