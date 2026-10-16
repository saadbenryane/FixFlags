import { Agent, createServer, request, type IncomingHttpHeaders, type IncomingMessage } from 'node:http'
import { connect, type Socket } from 'node:net'
import type { Duplex } from 'node:stream'
import type { Browser } from 'playwright'
import { normalizeAuditUrl, publicSocketLookup } from '../url'

const proxies = new WeakMap<Browser, string>()
export function bindPublicBrowserProxy(browser: Browser, server: string) { proxies.set(browser, server) }
export function publicBrowserProxyOptions(browser: Browser, allowLocalhost = false) {
  const server = proxies.get(browser)
  return server ? { server, bypass: allowLocalhost ? 'localhost,127.0.0.1' : '<-loopback>' } : undefined
}

function headersForHop(headers: IncomingHttpHeaders, upgrade = false) {
  const blocked = new Set(['connection', 'proxy-connection', 'proxy-authorization', 'keep-alive', 'te', 'trailer', 'transfer-encoding', 'upgrade',
    ...(headers.connection ?? '').toLowerCase().split(',').map(name => name.trim())])
  const result = Object.fromEntries(Object.entries(headers).filter(([name]) => !blocked.has(name)))
  if (upgrade) { result.connection = 'Upgrade'; result.upgrade = headers.upgrade }
  return result
}

/** Chromium keeps its own DNS resolver. The loopback proxy owns the actual
 * public socket without decrypting TLS or replacing browser request policy. */
export async function startPublicBrowserProxy() {
  const sockets = new Set<Duplex>()
  const track = <T extends Duplex>(socket: T): T => {
    sockets.add(socket); socket.once('close', () => sockets.delete(socket))
    socket.on('error', () => socket.destroy())
    return socket
  }
  const agent = new Agent({ keepAlive: true, lookup: publicSocketLookup })
  const target = (raw: string) => {
    const normalized = normalizeAuditUrl(raw)
    if (!normalized.ok) throw new Error('Non-public browser destination')
    return new URL(normalized.url)
  }
  const server = createServer((incoming, outgoing) => {
    try {
      const url = target(incoming.url ?? '')
      if (url.protocol !== 'http:') throw new Error('HTTPS requires a tunnel')
      const upstream = request(url, { method: incoming.method, headers: headersForHop(incoming.headers), agent }, response => {
        outgoing.writeHead(response.statusCode ?? 502, headersForHop(response.headers))
        response.on('error', () => outgoing.destroy())
        response.pipe(outgoing)
      })
      // A refused or interrupted proxy connection is not an origin response.
      upstream.on('error', () => outgoing.destroy())
      outgoing.on('close', () => upstream.destroy())
      incoming.on('error', () => upstream.destroy())
      incoming.pipe(upstream)
    } catch { outgoing.destroy() }
  })
  server.on('connection', socket => { track(socket) })
  server.on('clientError', (_error, socket) => socket.destroy())
  server.on('connect', (incoming, client, head) => {
    try {
      const url = target('https://' + (incoming.url ?? ''))
      if (url.pathname !== '/' || url.search) throw new Error('Invalid tunnel destination')
      const upstream = track(connect({ host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || 443), lookup: publicSocketLookup }))
      const timeout = setTimeout(() => { upstream.destroy(); client.destroy() }, 10_000)
      upstream.once('connect', () => {
        clearTimeout(timeout)
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        if (head.length) upstream.write(head)
        client.pipe(upstream); upstream.pipe(client)
      })
      upstream.once('error', () => client.destroy())
      upstream.once('close', () => { clearTimeout(timeout); client.destroy() })
      client.once('close', () => { clearTimeout(timeout); upstream.destroy() })
    } catch { client.destroy() }
  })
  server.on('upgrade', (incoming: IncomingMessage, client: Socket, head: Buffer) => {
    try {
      const url = target(incoming.url ?? '')
      if (url.protocol !== 'http:') throw new Error('HTTPS requires a tunnel')
      const upstream = request(url, { method: incoming.method, headers: headersForHop(incoming.headers, true), agent })
      upstream.once('upgrade', (response, socket, received) => {
        track(socket)
        client.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n` +
          Object.entries(headersForHop(response.headers, true)).flatMap(([name, values]) =>
            (Array.isArray(values) ? values : [values]).filter(value => value !== undefined).map(value => `${name}: ${value}\r\n`)).join('') + '\r\n')
        if (received.length) client.write(received)
        if (head.length) socket.write(head)
        client.pipe(socket); socket.pipe(client)
        client.once('close', () => socket.destroy()); socket.once('close', () => client.destroy())
      })
      upstream.once('response', () => { upstream.destroy(); client.destroy() })
      upstream.once('error', () => client.destroy())
      client.once('close', () => upstream.destroy())
      upstream.end()
    } catch { client.destroy() }
  })
  try {
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
  } catch (error) { agent.destroy(); throw error }
  const address = server.address() as { port: number }
  let closing: Promise<void> | undefined
  return { url: `http://127.0.0.1:${address.port}`,
    close: () => closing ??= new Promise<void>((resolve, reject) => {
      for (const socket of sockets) socket.destroy()
      agent.destroy()
      server.close(error => error ? reject(error) : resolve())
    }) }
}
