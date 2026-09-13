import { existsSync } from 'node:fs'
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { chromium, type Browser } from 'playwright'
import { runPathProbe } from '@/lib/integrity/run-path-probe'

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
    await closeServer?.()
    await browser?.close()
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
      }),
  }
}

async function serveFixture(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const raw = (request.url ?? '/').split('?')[0]
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
