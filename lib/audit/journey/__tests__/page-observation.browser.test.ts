import { createServer } from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { createAuditPage } from '../../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { pageHasClearHeadline, pageHasPrimaryCta, countVisibleFormFields, discoverJourneyLinks } from '../discover'
import { observeJourneyPage } from '../page-observation'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native public journey page conditions', () => {
  afterAll(closeBrowser)
  it('rejects hidden headline, fields and paths, and offscreen or disabled primary actions', async () => {
    const server = createServer((_request, response) => {
      response.setHeader('content-type', 'text/html')
      response.end('<html><body><main><p>Read meaningful public information before choosing your next step.</p></main></body></html>')
    })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const url = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    let session: Awaited<ReturnType<typeof createAuditPage>> | undefined
    try {
      session = await createAuditPage(await getAuditBrowser(), url, { profile: DESKTOP_CAPTURE_PROFILE, allowLocalhost: true, deadline: Date.now() + 10_000 })
      const page = session.page
      await page.locator('main').evaluate(main => main.insertAdjacentHTML('beforeend',
        '<div hidden><h1>Hidden headline with useful words</h1><a href="/pricing">See pricing</a><input type="email"></div>' +
        '<div style="opacity:0"><input type="text"><button>Get started</button></div>' +
        '<button disabled>Try now</button><button style="position:absolute;top:3000px">Start free</button>'))
      expect(await pageHasClearHeadline(page)).toBe(false)
      expect(await pageHasPrimaryCta(page)).toEqual({ found: false, text: null })
      expect(await countVisibleFormFields(page)).toBe(0)
      expect(await discoverJourneyLinks(page, url)).toEqual([])
      await page.locator('main').evaluate(main => main.insertAdjacentHTML('beforeend',
        '<h1>Visible headline with useful words</h1><a href="/signup">Get started</a><input type="email">'))
      expect(await pageHasClearHeadline(page)).toBe(true)
      expect(await pageHasPrimaryCta(page)).toEqual({ found: true, text: 'Get started' })
      expect(await countVisibleFormFields(page)).toBe(1)
      const conditions = { headline: true, primaryAction: true, nextPath: true, fieldCount: 1 }
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: 200, cfMitigated: 'challenge' })).toMatchObject({ available: false })
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: 503 })).toMatchObject({ available: false })
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: session.httpStatus })).toMatchObject({ available: true })
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }, 20_000)
})
