import { createServer, type Server } from 'node:http'
import { createHash } from 'node:crypto'
import { chromium } from 'playwright'
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest'
import { closeBrowser, getAuditBrowser, getChromePath } from '../screenshot'
import { startPublicBrowserProxy } from './public-proxy'

const dns = vi.hoisted(() => ({ resolve4: vi.fn(async () => ['127.0.0.1']), resolve6: vi.fn(async () => []) }))
vi.mock('node:dns/promises', () => dns)
const run = process.env.KEYBOARD_BROWSER_REQUIRED === 'true' ? describe : describe.skip
async function listen(server: Server) {
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  return (server.address() as { port: number }).port
}
async function close(server: Server) {
  server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()))
}
run('browser public connection boundary', () => {
  afterEach(() => vi.unstubAllEnvs())
  afterAll(closeBrowser)
  it('refuses rebound DNS even when Chromium maps the hostname to the private fixture', async () => {
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'false')
    let requests = 0
    const server = createServer((_request, response) => { requests++; response.end('<h1>Controlled private fixture</h1>') })
    const port = await listen(server), proxy = await startPublicBrowserProxy()
    const browser = await chromium.launch({ headless: true, executablePath: getChromePath(),
      args: ['--no-sandbox', '--disable-dev-shm-usage', '--host-resolver-rules=MAP rebound.fixture.test 127.0.0.1'],
      proxy: { server: proxy.url, bypass: '<-loopback>' } })
    try {
      const page = await browser.newPage()
      await expect(page.goto(`http://rebound.fixture.test:${port}/`, { timeout: 5000 })).rejects.toThrow()
      expect(dns.resolve4).toHaveBeenCalledWith('rebound.fixture.test')
      expect(requests).toBe(0)
    } finally { await browser.close(); await proxy.close(); await close(server) }
  }, 15_000)
  it('forces managed browser contexts through public validation, including literal loopback destinations', async () => {
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'false')
    let requests = 0
    const server = createServer((_request, response) => { requests++; response.end('<h1>Controlled private fixture</h1>') })
    const port = await listen(server), context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await expect(page.goto(`http://127.0.0.1:${port}/`, { timeout: 5000 })).rejects.toThrow()
      expect(requests).toBe(0)
    } finally { await context.close(); await close(server) }
  })
  it('preserves real HTTP redirects, cookies, resources and request bodies through the proxy for approved development targets', async () => {
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    const bodies: string[] = [], headers: Array<{ host?: string; proxy?: string }> = []
    const server = createServer(async (request, response) => {
      headers.push({ host: request.headers.host, proxy: request.headers['proxy-authorization'] as string | undefined })
      if (request.url === '/start') { response.writeHead(302, { location: '/landing', 'set-cookie': ['one=1; Path=/', 'two=2; Path=/'] }); response.end(); return }
      if (request.url === '/echo') {
        let body = ''; for await (const chunk of request) body += chunk
        bodies.push(body); response.end('Recorded'); return
      }
      if (request.url === '/resource') { response.setHeader('content-type', 'application/javascript'); response.end('document.body.dataset.resource="loaded"'); return }
      response.setHeader('content-type', 'text/html')
      response.end('<html><body><h1>Public proxy fixture</h1><script src="/resource"></script></body></html>')
    })
    server.on('upgrade', (request, socket) => {
      const accept = createHash('sha1').update(request.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
      socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n')
      const message = Buffer.from('Fixture socket')
      socket.write(Buffer.concat([Buffer.from([0x81, message.length]), message]))
      socket.on('data', () => socket.end())
    })
    const port = await listen(server), context = await (await getAuditBrowser()).newContext()
    try {
      const page = await context.newPage()
      await page.goto(`http://127.0.0.1:${port}/start`)
      expect(await page.locator('h1').innerText()).toBe('Public proxy fixture')
      expect(await page.locator('body').getAttribute('data-resource')).toBe('loaded')
      expect((await context.cookies()).map(cookie => cookie.name).sort()).toEqual(['one', 'two'])
      expect(await page.evaluate(() => fetch('/echo', { method: 'POST', body: 'fixture-body' }).then(response => response.text()))).toBe('Recorded')
      expect(bodies).toEqual(['fixture-body'])
      expect(await page.evaluate(url => new Promise((resolve, reject) => {
        const socket = new WebSocket(url)
        socket.onmessage = event => { resolve(event.data); socket.close() }
        socket.onerror = () => reject(new Error('Fixture WebSocket did not connect'))
      }), `ws://127.0.0.1:${port}/socket`)).toBe('Fixture socket')
      expect(headers.every(header => header.host === `127.0.0.1:${port}` && !header.proxy)).toBe(true)
    } finally { await context.close(); await close(server) }
  })
})
