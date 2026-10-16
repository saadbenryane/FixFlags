import { existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { runPathProbe } from '@/lib/integrity/run-path-probe'
import { runGoalProbe } from '@/lib/integrity/run-goal-probe'
import * as storage from '@/lib/integrity/storage'

const FIXTURES = path.join(process.cwd(), 'lib/integrity/__tests__/fixtures')

function playwrightChromiumAvailable() {
  try {
    const executablePath = chromium.executablePath()
    return Boolean(executablePath && existsSync(executablePath))
  } catch {
    return false
  }
}

describe.skipIf(!playwrightChromiumAvailable())('runPathProbe', () => {
  let browser: Browser
  let origin: string
  let closeServer: () => Promise<void>

  beforeAll(async () => {
    browser = await chromium.launch({ headless: true })
    const started = await listenFixtures()
    origin = started.origin
    closeServer = started.close
  }, 60_000)

  afterAll(async () => {
    try { await browser?.close() }
    finally { await closeServer?.() }
  })

  it('walks a working buy path to GREEN with watchable evidence', async () => {
    const result = await runPathProbe({
      runId: `green-${Date.now()}`,
      url: `${origin}/green/`,
      allowLocalhost: true,
      browser,
      confirmRed: false,
    })
    expect(result.health).toBe('GREEN')
    expect(result.reason).toBe('checkout_reached')
    expect(result.videoUrl || result.gifUrl).toBeTruthy()
    expect(result.steps.some((step) => step.label === 'checkout')).toBe(true)
    expect(result.finalUrl).toMatch(/checkout/)
    expect(result.finalUrl).not.toMatch(/thank|payment|complete-order/)
  }, 90_000)

  it('confirms a dead Add to cart as RED', async () => {
    const result = await runPathProbe({
      runId: `red-${Date.now()}`,
      url: `${origin}/red-atc/`,
      allowLocalhost: true,
      browser,
    })
    expect(result.health).toBe('RED')
    expect(result.reason).toBe('add_to_cart_noop')
    expect(result.confirmed).toBe(true)
    expect(result.attempts).toHaveLength(2)
    expect(result.videoUrl || result.gifUrl).toBeTruthy()
  }, 90_000)

  it.each(['checkout', 'configured'] as const)('continues %s observations and releases the browser before optional storage settles', async kind => {
    let release!: () => void
    const held = new Promise<void>(resolve => { release = resolve })
    const upload = vi.spyOn(storage, 'uploadIntegrityArtifact').mockImplementation(async () => {
      await held
      return { key: 'late', url: 'late', localPath: null }
    })
    const pending = kind === 'configured' ? runGoalProbe({ runId: `held-goal-${Date.now()}`,
      browser, confirmRed: false, deadline: Date.now() + 15_000, config: {
        startUrl: `${origin}/green/`, allowLocalhost: true,
        steps: [{ action: 'click', selector: '#add' }, { action: 'click', role: 'link', name: 'Checkout' }],
        goal: { type: 'url_pattern', pattern: '/checkout' }, safety: 'stop-at-checkout', goalAfterStep: 2,
      } }) : runPathProbe({ runId: `held-storage-${Date.now()}`, url: `${origin}/green/`,
      allowLocalhost: true, browser, confirmRed: false, deadline: Date.now() + 15_000 })
    try {
      await vi.waitFor(() => expect(upload).toHaveBeenCalled(), { timeout: 10_000, interval: 20 })
      expect(browser.contexts()).toHaveLength(0)
      const result = await pending
      expect(result.health).toBe('GREEN')
      expect(result.finalUrl).toMatch(/checkout/)
      expect(result.steps.every(step => step.screenshotUrl === null)).toBe(true)
      expect(result.videoUrl).toBeNull()
      expect(result.gifUrl).toBeNull()
    } finally {
      release()
      await pending
      upload.mockRestore()
    }
  }, 25_000)

  for (const failure of ['http-failure', 'visible-error']) {
    it(`does not certify a ${failure} destination merely because its URL is checkout`, async () => {
      const result = await runPathProbe({ runId: `destination-${failure}-${Date.now()}`, url: `${origin}/${failure}/`, allowLocalhost: true, browser })
      expect(result.health).toBe('RED')
      expect(result.confirmed).toBe(true)
      expect(result.attempts).toHaveLength(2)
      expect(result.reason).toBe(failure === 'http-failure' ? 'http_error' : 'checkout_error')
      expect(result.attempts.every(attempt => !attempt.outcome.reachedCheckout)).toBe(true)
      if (failure === 'http-failure') expect(result.attempts.every(attempt => attempt.outcome.httpStatus === 503)).toBe(true)
    }, 90_000)
  }

  it.each(['hidden-cart', 'transparent-cart', 'branding-text', 'branding-frame', 'branding-visible-frame', 'embedded-hidden'])('requires an observed checkout surface instead of %s markup', async mode => {
    const result = await runPathProbe({ runId: `surface-${mode}-${Date.now()}`, url: `${origin}/${mode}/`, allowLocalhost: true, browser, confirmRed: false })
    expect(result.attempts[0].outcome.reachedCheckout).toBe(false)
    expect(result.health).toBe('RED')
    expect(result.reason).toBe('add_to_cart_noop')
  }, 30_000)

  it('recognizes a visible embedded checkout surface reached through the buy control', async () => {
    const result = await runPathProbe({ runId: `surface-embedded-${Date.now()}`, url: `${origin}/embedded-checkout/`, allowLocalhost: true, browser, confirmRed: false })
    expect(result.health).toBe('GREEN')
    expect(result.steps.find(step => step.label === 'checkout')?.destinationUrl).toBe(`${origin}/checkout`)
  }, 30_000)

  it.each(['empty', 'challenge', 'unavailable'])('retains embedded checkout %s evidence without inventing success', async mode => {
    const result = await runPathProbe({ runId: `embedded-${mode}-${Date.now()}`, url: `${origin}/embedded-${mode}/`, allowLocalhost: true, browser, confirmRed: false })
    expect(result.attempts[0].outcome.reachedCheckout).toBe(false)
    expect(result.health).toBe(mode === 'unavailable' ? 'RED' : 'UNKNOWN')
    if (mode === 'unavailable') expect(result.attempts[0].outcome.httpStatus).toBe(503)
    expect(result.steps.at(-1)?.destinationUrl).toBe(`${origin}/checkout/${mode}`)
  }, 30_000)

  it('returns UNKNOWN when the page has no buy control', async () => {
    const result = await runPathProbe({
      runId: `unknown-${Date.now()}`,
      url: `${origin}/unknown/`,
      allowLocalhost: true,
      browser,
      confirmRed: false,
    })
    expect(result.health).toBe('UNKNOWN')
    expect(result.reason).toBe('no_buy_control')
  }, 90_000)
})

async function listenFixtures(): Promise<{ origin: string; close: () => Promise<void> }> {
  const server = createServer((request: IncomingMessage, response: ServerResponse) => {
    void serveFixture(request, response)
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('fixture server missing port')
  return {
    origin: `http://127.0.0.1:${address.port}`,
    close: () =>
      new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
        server.closeAllConnections()
      }),
  }
}

async function serveFixture(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const raw = (request.url ?? '/').split('?')[0]
  if (['/hidden-cart/', '/transparent-cart/', '/branding-text/', '/branding-frame/', '/branding-visible-frame/', '/embedded-checkout/', '/embedded-hidden/', '/embedded-empty/', '/embedded-challenge/', '/embedded-unavailable/'].includes(raw)) {
    const mode = raw.slice(1, -1)
    const markup = mode === 'hidden-cart' ? '<div id="CartDrawer" hidden>Your cart (1)<a href="/checkout">Checkout</a></div>'
      : mode === 'transparent-cart' ? '<div style="opacity:0"><div id="CartDrawer">Your cart (1)</div></div>'
        : mode === 'branding-text' ? '<footer>Pay securely with Shop Pay</footer>'
          : mode === 'branding-frame' ? '<iframe hidden src="/shopify-brand"></iframe>'
            : mode === 'branding-visible-frame' ? '<iframe src="/shopify-brand"></iframe>' : ''
    const frameUrl = ['embedded-checkout', 'embedded-hidden'].includes(mode) ? '/checkout' : '/checkout/' + mode.replace('embedded-', '')
    const action = mode.startsWith('embedded-') ? '<script>document.querySelector("#add").onclick=()=>{const f=document.createElement("iframe");f.src=' + JSON.stringify(frameUrl) + ';f.style="width:350px;height:600px";' + (mode === 'embedded-hidden' ? 'f.hidden=true;' : '') + 'document.body.append(f)}</script>' : ''
    response.writeHead(200, { 'Content-Type': 'text/html' })
    response.end('<h1>Canvas Tote</h1><button type="button" id="add">Add to cart</button>' + markup + action)
    return
  }
  if (raw === '/shopify-brand') { response.end('<p>Shopify</p>'); return }
  if (raw.startsWith('/checkout/')) {
    response.writeHead(raw.endsWith('/unavailable') ? 503 : 200, { 'Content-Type': 'text/html' })
    response.end(raw.endsWith('/unavailable') ? '<h1>Checkout is unavailable</h1>'
      : raw.endsWith('/challenge') ? '<h1>Checking your browser</h1><input type="email">' : '<h1>Checkout</h1><p>Loading</p>')
    return
  }
  const failure = raw.match(/^\/(http-failure|visible-error)(?:\/|$)/)?.[1]
  if (failure) {
    const checkout = raw.endsWith('/checkout')
    response.writeHead(checkout && failure === 'http-failure' ? 503 : 200, { 'Content-Type': 'text/html' })
    response.end(checkout ? '<h1>Checkout is unavailable</h1><p>Something went wrong.</p>' : `<h1>Trail Pack</h1><a href="/${failure}/checkout">Buy now</a>`)
    return
  }
  let relative = decodeURIComponent(raw).replace(/^\//, '')
  if (raw === '/checkout' || raw === '/checkout/') relative = 'green/checkout.html'
  else if (relative.endsWith('/')) relative += 'index.html'
  else if (relative.endsWith('/checkout') || relative === 'green/checkout') {
    relative = 'green/checkout.html'
  }
  const filePath = path.join(FIXTURES, relative)
  try {
    const body = await fs.readFile(filePath)
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain' })
    response.end('not found')
  }
}
