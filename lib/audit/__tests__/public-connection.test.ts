import { createServer } from 'node:http'
import { Agent } from 'undici'
import { afterEach, describe, expect, it, vi } from 'vitest'

const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn(), cancel: vi.fn() }))
vi.mock('node:dns/promises', async () => (await import('@/lib/audit/__tests__/dns-fixture')).dnsFixture(dns))
import { PublicRequestError, safeFetchDocument } from '../url'
import { publicHttpCapacity } from '../progressive/capacity'
import { classifyPublicRequestFailure } from '../http-failure'

describe('public HTTP connection authority', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks() })
  it('keeps an unfinished connection lookup unknown instead of reporting an origin timeout', async () => {
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockImplementation(() => new Promise(() => {}))
    dns.resolve6.mockResolvedValue([])
    const failure = await safeFetchDocument('http://stalled-connection.fixture.test/', { publicOnly: true, timeoutMs: 80 })
      .catch(error => error)
    expect(dns.resolve4).toHaveBeenCalledTimes(2)
    expect(classifyPublicRequestFailure(failure).result).toBe('UNKNOWN')
    expect(dns.cancel).toHaveBeenCalledOnce()
  })
  it('retains a completed absent-domain result from connection-time DNS instead of its fetch wrapper', async () => {
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockRejectedValue(Object.assign(new Error('No address record'), { code: 'ENOTFOUND' }))
    dns.resolve6.mockRejectedValue(Object.assign(new Error('No IPv6 record'), { code: 'ENODATA' }))
    const failure = await safeFetchDocument('http://absent-connection.fixture.test/', { publicOnly: true, timeoutMs: 1000 }).catch(error => error)
    expect(dns.resolve4).toHaveBeenCalledTimes(2)
    expect(failure).toMatchObject({ code: 'DNS_NOT_FOUND' })
    expect(classifyPublicRequestFailure(failure)).toMatchObject({ result: 'FAILED', reason: 'dns_failure' })
  })
  it('reuses healthy connections across independently admitted observations', async () => {
    let requests = 0, connections = 0
    const server = createServer((_request, response) => { requests++; response.end('Current public document') })
    server.on('connection', () => { connections++ })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    try {
      for (let index = 0; index < 8; index++) expect(await safeFetchDocument(origin + '/' + index)).toMatchObject({ statusCode: 200, complete: true })
      expect(requests).toBe(8)
      expect(connections).toBeLessThanOrEqual(2)
      expect(publicHttpCapacity.running).toBe(0)
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())) }
  })
  it('keeps a simultaneous origin timeout failed while another Site has unfinished DNS', async () => {
    const requests: string[] = []
    const server = createServer(request => { requests.push(request.url!) })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    const origin = 'http://127.0.0.1:' + (server.address() as { port: number }).port
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'true')
    dns.resolve4.mockResolvedValueOnce(['93.184.216.34']).mockImplementation(() => new Promise(() => {}))
    dns.resolve6.mockResolvedValue([])
    const unresolved = safeFetchDocument('http://simultaneous-dns.fixture.test/', { timeoutMs: 250, publicOnly: true }).catch(error => error)
    try {
      await vi.waitFor(() => expect(dns.resolve4).toHaveBeenCalledTimes(2))
      const failure = await safeFetchDocument(origin + '/no-response', { timeoutMs: 80 }).catch(error => error)
      expect(requests).toEqual(['/no-response'])
      expect(failure).toBeInstanceOf(PublicRequestError)
      expect(classifyPublicRequestFailure(failure)).toMatchObject({ result: 'FAILED', reason: 'response_timeout' })
      expect(classifyPublicRequestFailure(await unresolved).result).toBe('UNKNOWN')
      expect(dns.cancel).toHaveBeenCalledOnce()
      expect(publicHttpCapacity.running).toBe(0)
    } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); await unresolved }
  })
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
