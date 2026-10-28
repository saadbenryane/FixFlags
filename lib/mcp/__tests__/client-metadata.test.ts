import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:net'
const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }))
vi.mock('node:dns/promises', () => dns)
import { redirectAllowedForClient } from '../oauth'

const clientId = 'https://mcp-client.example/client.json', redirectUri = 'https://assistant.example/callback'
const transport = vi.fn()
const nativeFetch = globalThis.fetch
beforeEach(() => {
  dns.resolve4.mockReset().mockResolvedValue(['93.184.216.34'])
  dns.resolve6.mockReset().mockResolvedValue([])
  transport.mockReset().mockImplementation(async () => Response.json({ client_id: clientId, redirect_uris: [redirectUri] }))
  vi.stubGlobal('fetch', transport)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('public OAuth client metadata admission', () => {
  it('rechecks changed DNS at the native socket without connecting to the private service', async () => {
    let connections = 0
    const server = createServer(socket => { connections++; socket.destroy() })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockResolvedValue(['127.0.0.1'])
    vi.stubGlobal('fetch', nativeFetch)
    try {
      const endpoint = 'https://mcp-client.example:' + (server.address() as { port: number }).port + '/client.json'
      expect(await redirectAllowedForClient(endpoint, redirectUri)).toBe(false)
      expect(dns.resolve4).toHaveBeenCalledTimes(2)
      expect(connections).toBe(0)
    } finally { await new Promise<void>(resolve => server.close(() => resolve())) }
  })
  it.each(['127.0.0.1', '10.0.0.2', '169.254.169.254', '::1'])('cannot admit metadata from DNS resolving to %s', async address => {
    dns.resolve4.mockResolvedValue(address.includes(':') ? [] : [address])
    dns.resolve6.mockResolvedValue(address.includes(':') ? [address] : [])
    expect(await redirectAllowedForClient(clientId, redirectUri)).toBe(false)
    expect(transport).not.toHaveBeenCalled()
  })
  it('requires the exact metadata client and redirect identities', async () => {
    expect(await redirectAllowedForClient(clientId, redirectUri)).toBe(true)
    expect(await redirectAllowedForClient(clientId, redirectUri + '/other')).toBe(false)
    transport.mockResolvedValueOnce(Response.json({ client_id: clientId + '?other', redirect_uris: [redirectUri] }))
    expect(await redirectAllowedForClient(clientId, redirectUri)).toBe(false)
  })
  it('does not accept a complete-looking prefix of an oversized metadata document', async () => {
    transport.mockImplementation(async () => new Response(JSON.stringify({ client_id: clientId, redirect_uris: [redirectUri], padding: 'x'.repeat(70_000) })))
    expect(await redirectAllowedForClient(clientId, redirectUri)).toBe(false)
  })
  it('does not follow metadata redirects or admit partial JSON', async () => {
    transport.mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: 'https://other.example/metadata' } }))
    expect(await redirectAllowedForClient(clientId, redirectUri)).toBe(false)
    expect(transport).toHaveBeenCalledOnce()
    transport.mockResolvedValueOnce(new Response('{"client_id":'))
    expect(await redirectAllowedForClient(clientId, redirectUri)).toBe(false)
  })
})
