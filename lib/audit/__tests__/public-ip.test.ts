import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createServer } from 'node:http'
const dns = vi.hoisted(() => ({ resolve4: vi.fn(), resolve6: vi.fn() }))
vi.mock('node:dns/promises', () => dns)
import { isPublicIp, normalizeAuditUrl, resolvePublicAddresses, publicSocketLookup, safeFetchDocument, AuditUrlError } from '../url'

describe('public network classification', () => {
  it.each(['192.0.1.1', '192.0.3.1', '192.0.255.254', '198.51.99.255', '198.51.101.0', '203.0.112.255', '203.0.114.0',
    '192.0.0.9', '192.0.0.10', '2001:db80::1', '2001:db90::1', '2001:3::1', '2001:4:112::1', '2001:1::1',
    '2001:1::2', '2001:1::3', '2001:20::1', '2001:30::1', '2606:4700:4700::1111'])('admits the public address %s without expanding neighboring reserved subnets', address => {
    expect(isPublicIp(address)).toBe(true)
    const host = address.includes(':') ? '[' + address + ']' : address
    expect(normalizeAuditUrl('https://' + host + '/').ok).toBe(true)
  })

  it.each(['192.0.0.0', '192.0.0.8', '192.0.0.11', '192.0.0.170', '192.0.0.255', '192.0.2.0', '192.0.2.255',
    '198.51.100.0', '198.51.100.255', '203.0.113.0', '203.0.113.255', '192.88.99.2',
    '::2', '::8.8.8.8', 'fec0::1', '100::1', '100:0:0:1::1', '64:ff9b:1::1', '2001:2::1', '2001:10::1',
    '2001:1::4', '2001:4:113::1', '2001:db8::1', '3fff::1', '3fff:fff::1', '5f00::1', '4000::1', '2606:4700::1%lo0'])('refuses the non-public or ambiguous address %s', address => {
    expect(isPublicIp(address)).toBe(false)
  })

  it.each([
    ['::ffff:8.8.8.8', true], ['::ffff:203.0.114.1', true], ['::ffff:10.0.0.1', false],
    ['64:ff9b::808:808', true], ['64:ff9b::7f00:1', false], ['64:ff9b::c0a8:1', false], ['64:ff9b::c633:6401', false],
    ['2002:808:808::1', true], ['2002:a00:1::1', false], ['2002:7f00:1::1', false],
    ['2001:0:808:808:8000:1234:fefe:fefe', true], ['2001:0:808:808:8000:1234:f5ff:fffe', false],
    ['2001:0:a00:1:8000:1234:fefe:fefe', false],
  ] as const)('retains public IPv4 embedding while refusing private embedded destinations: %s', (address, allowed) => {
    expect(isPublicIp(address)).toBe(allowed)
  })
})

describe('shared DNS and transport admission', () => {
  const fetch = vi.fn()
  beforeEach(() => {
    dns.resolve4.mockReset(); dns.resolve6.mockReset(); fetch.mockReset()
    dns.resolve4.mockResolvedValue(['203.0.114.1']); dns.resolve6.mockResolvedValue([])
    fetch.mockImplementation(async () => new Response('Public response', { status: 200 }))
    vi.stubGlobal('fetch', fetch)
  })
  afterEach(() => vi.unstubAllGlobals())

  it('admits corrected public DNS through both preflight and the actual socket lookup contract', async () => {
    expect(await resolvePublicAddresses('public.example')).toEqual(['203.0.114.1'])
    const records = await new Promise<unknown>((resolve, reject) => publicSocketLookup('public.example', { all: true },
      (error, addresses) => error ? reject(error) : resolve(addresses)))
    expect(records).toEqual([{ address: '203.0.114.1', family: 4 }])
    expect(await safeFetchDocument('https://public.example/', { publicOnly: true })).toMatchObject({ statusCode: 200, body: 'Public response' })
  })

  it('rejects mixed answers before sending even when the IPv4 answer is publicly eligible', async () => {
    dns.resolve6.mockResolvedValue(['64:ff9b::7f00:1'])
    await expect(safeFetchDocument('https://public.example/', { publicOnly: true })).rejects.toBeInstanceOf(AuditUrlError)
    expect(fetch).not.toHaveBeenCalled()
  })

  it('rejects newly reserved and private-embedded redirect destinations before a second request', async () => {
    for (const target of ['https://[3fff::1]/', 'https://[2002:7f00:1::1]/', 'https://[64:ff9b::a00:1]/']) {
      fetch.mockClear(); fetch.mockResolvedValue(new Response(null, { status: 302, headers: { location: target } }))
      await expect(safeFetchDocument('https://public.example/', { publicOnly: true })).rejects.toBeInstanceOf(AuditUrlError)
      expect(fetch).toHaveBeenCalledOnce()
    }
  })
})

describe('native HTTP socket admission', () => {
  it.each(['127.0.0.1', '64:ff9b::7f00:1', '3fff::1'])('rejects rebound DNS at connection time: %s', async address => {
    vi.stubEnv('DEV_ALLOW_LOCALHOST', 'false')
    let requests = 0
    const server = createServer((_request, response) => { requests++; response.end('Private fixture') })
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
    dns.resolve4.mockReset().mockResolvedValueOnce(['203.0.114.1']).mockResolvedValue(address.includes(':') ? [] : [address])
    dns.resolve6.mockReset().mockResolvedValueOnce([]).mockResolvedValue(address.includes(':') ? [address] : [])
    try {
      const port = (server.address() as { port: number }).port
      const failure = await safeFetchDocument(`http://rebound.fixture.test:${port}/capture`, { publicOnly: true, timeoutMs: 2000 })
        .then(() => null, (error: unknown) => error)
      expect(failure).toMatchObject({ cause: expect.any(AuditUrlError) })
      expect(dns.resolve4).toHaveBeenCalledTimes(2)
      expect(requests).toBe(0)
    } finally {
      vi.unstubAllEnvs(); server.closeAllConnections()
      await new Promise<void>(resolve => server.close(() => resolve()))
    }
  })
})
