import { createServer } from 'node:http'
import { Agent } from 'undici'
import { afterEach, describe, expect, it, vi } from 'vitest'

const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }))
vi.mock('node:dns/promises', () => dns)
import { safeFetchDocument } from '../url'

describe('public HTTP connection authority', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.resetAllMocks() })
  it('refuses a private address returned after the public preflight without contacting the private server', async () => {
    let requests = 0
    const server = createServer((_request, response) => { requests++; response.end('Controlled private fixture') })
    await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve) })
    const port = (server.address() as { port: number }).port
    const rebound = new Agent({ connect: { lookup: (_hostname, options, callback) => {
      if (options.all) callback(null, [{ address: '127.0.0.1', family: 4 }])
      else callback(null, '127.0.0.1', 4)
    } } })
    const nativeFetch = globalThis.fetch
    vi.stubGlobal('fetch', (input: string | URL | Request, options?: RequestInit & { dispatcher?: Agent }) =>
      nativeFetch(input, { ...options, dispatcher: options?.dispatcher ?? rebound } as RequestInit))
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockResolvedValue(['127.0.0.1'])
    dns.resolve6.mockResolvedValue([])
    try {
      await expect(safeFetchDocument(`http://rebound.example.com:${port}/`, { publicOnly: true, timeoutMs: 1000 }))
        .rejects.toThrow()
      expect(dns.resolve4).toHaveBeenCalledTimes(2)
      expect(requests).toBe(0)
    } finally {
      await rebound.close()
      server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
