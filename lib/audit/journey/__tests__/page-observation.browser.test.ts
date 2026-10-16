import { createServer } from 'node:http'
import { afterAll, describe, expect, it } from 'vitest'
import { getAuditBrowser, closeBrowser } from '../../screenshot'
import { createAuditPage } from '../../browser/page-session'
import { DESKTOP_CAPTURE_PROFILE } from '../../browser/capture-profile'
import { pageHasClearHeadline, pageHasPrimaryCta, countVisibleFormFields, discoverJourneyLinks } from '../discover'
import { observeJourneyPage } from '../page-observation'
import { journeyAssertions } from '../../checks/journey-evidence'

const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
run('native public journey page conditions', () => {
  afterAll(closeBrowser)
  it('measures readable headline text and honors a visible child overriding inherited visibility', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><div style="visibility:hidden"><h1 style="visibility:visible">Plan useful projects for teams</h1></div></main>')
      expect(await pageHasClearHeadline(page)).toBe(true)
      await page.locator('main').evaluate(element => { element.innerHTML = '<h1>Hi<span hidden>Hidden padding makes this headline long</span></h1>' })
      expect(await pageHasClearHeadline(page)).toBe(false)
    } finally { await context.close() }
  })
  it('recognizes a visible conversion label independently of its URL and CSS class while retaining generic enabled controls', async () => {
    const context = await (await getAuditBrowser()).newContext({ viewport: { width: DESKTOP_CAPTURE_PROFILE.width, height: DESKTOP_CAPTURE_PROFILE.height } })
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<main><section id="cohort"><a id="original" href="/start">Get started</a></section></main>' }))
      await page.goto('https://example.com/')
      expect(await pageHasPrimaryCta(page)).toEqual({ found: true, text: 'Get started', complete: true })
      await page.locator('#cohort').evaluate(element => { (element as HTMLElement).style.visibility = 'hidden' })
      await page.locator('#original').evaluate(element => { (element as HTMLElement).style.visibility = 'visible' })
      expect(await pageHasPrimaryCta(page)).toEqual({ found: true, text: 'Get started', complete: true })
      for (const mode of ['inert', 'opacity'] as const) {
        await page.locator('#cohort').evaluate((element, mode) => {
          element.toggleAttribute('inert', mode === 'inert'); (element as HTMLElement).style.opacity = mode === 'opacity' ? '0' : '1'
        }, mode)
        expect(await pageHasPrimaryCta(page)).toEqual({ found: false, text: null, complete: true })
      }
      await page.locator('main').evaluate(element => { element.innerHTML = '<button disabled>Continue</button><a href="/legal">Legal terms</a>' })
      expect(await pageHasPrimaryCta(page)).toEqual({ found: false, text: null, complete: true })
      await page.locator('button').evaluate(element => { (element as HTMLButtonElement).disabled = false })
      expect(await pageHasPrimaryCta(page)).toEqual({ found: true, text: 'Continue', complete: true })
    } finally { await context.close() }
  })
  it('recognizes native input action captions without counting activation controls as signup fields', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      for (const type of ['button', 'submit']) {
        await page.setContent('<main><input id="action" type="' + type + '" value="Continue"></main>')
        expect(await pageHasPrimaryCta(page)).toEqual({ found: true, text: 'Continue', complete: true })
        expect(await countVisibleFormFields(page)).toBe(0)
        await page.locator('#action').evaluate(element => { (element as HTMLInputElement).disabled = true })
        expect(await pageHasPrimaryCta(page)).toEqual({ found: false, text: null, complete: true })
      }
      await page.setContent('<main><input type="reset"><input type="image" alt="Submit"><input type="email"><textarea></textarea><select><option>Choose</option></select></main>')
      expect(await countVisibleFormFields(page)).toBe(3)
    } finally { await context.close() }
  })
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
      expect(await pageHasPrimaryCta(page)).toEqual({ found: false, text: null, complete: true })
      expect(await countVisibleFormFields(page)).toBe(0)
      expect(await discoverJourneyLinks(page, url)).toEqual([])
      await page.locator('main').evaluate(main => main.insertAdjacentHTML('beforeend',
        '<h1>Visible headline with useful words</h1><a href="/signup">Get started</a><input type="email">'))
      expect(await pageHasClearHeadline(page)).toBe(true)
      expect(await pageHasPrimaryCta(page)).toEqual({ found: true, text: 'Get started', complete: true })
      expect(await countVisibleFormFields(page)).toBe(1)
      const conditions = { headline: true, primaryAction: true, nextPath: true, fieldCount: 1 }
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: 200, cfMitigated: 'challenge' })).toMatchObject({ available: false })
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: 503 })).toMatchObject({ available: false })
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: session.httpStatus })).toMatchObject({ available: true })
      await page.locator('main').evaluate(main => main.insertAdjacentHTML('afterbegin', '<h1 hidden>Verify you are human</h1>'))
      expect(await observeJourneyPage(page, 'signup', 'landing', [], conditions, false,
        { status: session.httpStatus })).toMatchObject({ available: true, headlineComplete: true, headlineVersion: 2 })
      await page.locator('main').evaluate(main => main.append(...Array.from({ length: 20_001 }, () => document.createTextNode(' '))))
      const incomplete = await observeJourneyPage(page, 'signup', 'landing', [], { ...conditions, headline: await pageHasClearHeadline(page) }, false,
        { status: session.httpStatus })
      expect(journeyAssertions(incomplete!).find(assertion => assertion.key === 'landing-headline')).toMatchObject({ complete: false })
      expect(journeyAssertions(incomplete!).find(assertion => assertion.key === 'landing-action')).toMatchObject({ complete: true })
    } finally {
      session?.disposeNetwork(); await session?.page.context().close()
      server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    }
  }, 20_000)
  it('discovers rendered paths after hidden copies and honors visibility overrides and inert controls', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><main>' +
        '<nav hidden>' + '<a href="/pricing">Pricing</a>'.repeat(85) + '</nav>' +
        '<div inert><a href="/signup-disabled">Get started</a></div><div style="visibility:hidden"><a style="visibility:visible" href="/signup">Get started</a></div></main>' }))
      await page.goto('https://example.com/')
      expect((await discoverJourneyLinks(page, 'https://example.com')).map(link => link.href)).toEqual(['https://example.com/signup'])
    } finally { await context.close() }
  })
  it('ranks all observed paths before limiting the retained routes', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.route('**', route => route.fulfill({ contentType: 'text/html', body: '<!doctype html><main>' +
        Array.from({ length: 100 }, (_, index) => '<a href="/features/' + index + '">Features</a>').join('') + '<a id="signup" href="/signup">Get started free</a></main>' }))
      await page.goto('https://example.com/')
      const links = await discoverJourneyLinks(page, 'https://example.com')
      expect(links).toHaveLength(80)
      expect(links[0]).toMatchObject({ href: 'https://example.com/signup', text: 'Get started free' })
      expect(await page.locator(links[0].selector!).getAttribute('id')).toBe('signup')
    } finally { await context.close() }
  })
  it('keeps a complete viewport absence when only an offscreen label exceeds the bound', async () => {
    const context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.setContent('<main><h1>Useful planning service for teams</h1><button style="position:absolute;top:3000px">' + 'Start free '.repeat(200) + '</button></main>')
      expect(await pageHasPrimaryCta(page)).toEqual({ found: false, text: null, complete: true })
    } finally { await context.close() }
  })
})
