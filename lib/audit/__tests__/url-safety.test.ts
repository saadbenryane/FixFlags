import assert from 'node:assert/strict'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { resolve4, resolve6 } = vi.hoisted(() => ({
  resolve4: vi.fn(),
  resolve6: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  resolve4,
  resolve6,
}))

import {
  isPublicIp,
  isBlockedHostname,
  normalizeAuditUrl,
  resolvePublicAddresses,
  assertPublicAuditUrl,
  safeFetchHtml,
  AuditUrlError,
} from '../url'

describe('isPublicIp', () => {
  it('accepts public IPv4 addresses', () => {
    assert.equal(isPublicIp('8.8.8.8'), true)
    assert.equal(isPublicIp('93.184.216.34'), true)
  })

  it('rejects private and reserved IPv4 ranges', () => {
    assert.equal(isPublicIp('10.0.0.1'), false)
    assert.equal(isPublicIp('127.0.0.1'), false)
    assert.equal(isPublicIp('169.254.1.1'), false)
    assert.equal(isPublicIp('172.16.0.1'), false)
    assert.equal(isPublicIp('172.31.255.255'), false)
    assert.equal(isPublicIp('192.168.1.1'), false)
    assert.equal(isPublicIp('100.64.0.1'), false)
    assert.equal(isPublicIp('100.127.255.255'), false)
    assert.equal(isPublicIp('0.0.0.0'), false)
    assert.equal(isPublicIp('224.0.0.1'), false)
    assert.equal(isPublicIp('198.18.0.1'), false)
  })

  it('rejects malformed input', () => {
    assert.equal(isPublicIp('not-an-ip'), false)
    assert.equal(isPublicIp(''), false)
  })

  it('handles IPv6 public, private, and mapped addresses', () => {
    assert.equal(isPublicIp('2606:4700:4700::1111'), true)
    assert.equal(isPublicIp('::1'), false)
    assert.equal(isPublicIp('::'), false)
    assert.equal(isPublicIp('fc00::1'), false)
    assert.equal(isPublicIp('fd12:3456::1'), false)
    assert.equal(isPublicIp('fe80::1'), false)
    assert.equal(isPublicIp('ff02::1'), false)
    assert.equal(isPublicIp('2001:db8::1'), false)
    assert.equal(isPublicIp('::ffff:10.0.0.1'), false)
    assert.equal(isPublicIp('::ffff:8.8.8.8'), true)
  })
})

describe('isBlockedHostname', () => {
  const originalDevAllowLocalhost = process.env.DEV_ALLOW_LOCALHOST

  afterEach(() => {
    if (originalDevAllowLocalhost === undefined) {
      delete process.env.DEV_ALLOW_LOCALHOST
    } else {
      process.env.DEV_ALLOW_LOCALHOST = originalDevAllowLocalhost
    }
  })

  it('blocks localhost variants and private hosts', () => {
    assert.equal(isBlockedHostname('localhost'), true)
    assert.equal(isBlockedHostname('app.localhost'), true)
    assert.equal(isBlockedHostname('127.0.0.1'), true)
    assert.equal(isBlockedHostname('::1'), true)
    assert.equal(isBlockedHostname('mybox.local'), true)
    assert.equal(isBlockedHostname('internal.example.internal'), true)
    assert.equal(isBlockedHostname('10.0.0.5'), true)
    assert.equal(isBlockedHostname('192.168.0.5'), true)
  })

  it('allows public hostnames', () => {
    assert.equal(isBlockedHostname('example.com'), false)
    assert.equal(isBlockedHostname('EXAMPLE.COM.'), false)
    assert.equal(isBlockedHostname('8.8.8.8'), false)
  })

  it('allows localhost when DEV_ALLOW_LOCALHOST is true', () => {
    process.env.DEV_ALLOW_LOCALHOST = 'true'
    assert.equal(isBlockedHostname('localhost'), false)
    assert.equal(isBlockedHostname('app.localhost'), false)
    assert.equal(isBlockedHostname('127.0.0.1'), false)
  })
})

describe('normalizeAuditUrl', () => {
  it('normalizes a valid https URL and strips the hash', () => {
    const result = normalizeAuditUrl('https://example.com/path#section')
    assert.ok(result.ok)
    if (result.ok) {
      assert.equal(result.url, 'https://example.com/path')
    }
  })

  it('accepts http and https only', () => {
    assert.ok(normalizeAuditUrl('https://example.com').ok)
    assert.ok(normalizeAuditUrl('http://example.com').ok)
    const ftp = normalizeAuditUrl('ftp://example.com/file')
    assert.ok(!ftp.ok)
    if (!ftp.ok) assert.match(ftp.error, /public HTTP and HTTPS/i)
  })

  it('rejects URLs containing credentials', () => {
    const result = normalizeAuditUrl('https://user:pass@example.com')
    assert.ok(!result.ok)
    if (!result.ok) assert.match(result.error, /credentials/i)
  })

  it('rejects localhost and private hosts', () => {
    const localhost = normalizeAuditUrl('https://localhost:3000')
    assert.ok(!localhost.ok)
    const privateHost = normalizeAuditUrl('http://10.0.0.5')
    assert.ok(!privateHost.ok)
  })

  it('rejects invalid URL format', () => {
    const result = normalizeAuditUrl('not a url at all')
    assert.ok(!result.ok)
    if (!result.ok) assert.equal(result.error, 'Invalid URL format')
  })
})

describe('resolvePublicAddresses', () => {
  beforeEach(() => {
    resolve4.mockReset()
    resolve6.mockReset()
  })

  it('passes through literal public IP addresses', async () => {
    assert.deepEqual(await resolvePublicAddresses('8.8.8.8'), ['8.8.8.8'])
    expect(resolve4).not.toHaveBeenCalled()
  })

  it('throws for blocked hostnames', async () => {
    await assert.rejects(() => resolvePublicAddresses('localhost'), AuditUrlError)
  })

  it('resolves v4 and v6 addresses from DNS', async () => {
    resolve4.mockResolvedValue(['93.184.216.34'])
    resolve6.mockResolvedValue(['2606:2800:220:1:248:1893:25c8:1946'])
    assert.deepEqual(await resolvePublicAddresses('example.com'), [
      '93.184.216.34',
      '2606:2800:220:1:248:1893:25c8:1946',
    ])
  })

  it('throws when no DNS records resolve', async () => {
    resolve4.mockRejectedValue(new Error('ENOTFOUND'))
    resolve6.mockRejectedValue(new Error('ENOTFOUND'))
    await assert.rejects(() => resolvePublicAddresses('missing.example'), AuditUrlError)
  })

  it('throws when a resolved address is private', async () => {
    resolve4.mockResolvedValue(['192.168.1.10'])
    resolve6.mockRejectedValue(new Error('no v6'))
    await assert.rejects(() => resolvePublicAddresses('internal.example'), AuditUrlError)
  })
})

describe('assertPublicAuditUrl', () => {
  beforeEach(() => {
    resolve4.mockReset()
    resolve6.mockReset()
  })

  it('returns the parsed URL for a public destination', async () => {
    resolve4.mockResolvedValue(['93.184.216.34'])
    resolve6.mockResolvedValue([])
    const parsed = await assertPublicAuditUrl('https://example.com/')
    assert.equal(parsed.origin, 'https://example.com')
  })

  it('throws AuditUrlError for private destinations', async () => {
    await assert.rejects(() => assertPublicAuditUrl('https://localhost:3000'), AuditUrlError)
  })

  it('throws AuditUrlError when DNS resolution fails', async () => {
    resolve4.mockRejectedValue(new Error('ENOTFOUND'))
    resolve6.mockRejectedValue(new Error('ENOTFOUND'))
    await assert.rejects(() => assertPublicAuditUrl('https://missing.example'), AuditUrlError)
  })
})

describe('safeFetchHtml', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    resolve4.mockReset()
    resolve6.mockReset()
    resolve4.mockResolvedValue(['93.184.216.34'])
    resolve6.mockResolvedValue([])
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function htmlResponse(
    body: string,
    init: { status?: number; contentType?: string; location?: string } = {}
  ): Response {
    const headers = new Headers()
    if (init.contentType) headers.set('content-type', init.contentType)
    if (init.location) headers.set('location', init.location)
    return new Response(body, { status: init.status ?? 200, headers })
  }

  it('fetches and returns html, finalUrl, status, and headers', async () => {
    fetchMock.mockResolvedValue(
      htmlResponse('<html><head><title>Hi</title></head></html>', {
        contentType: 'text/html; charset=utf-8',
      })
    )
    const result = await safeFetchHtml('https://example.com/', { maxBytes: 1000 })
    assert.equal(result.statusCode, 200)
    assert.match(result.html, /<title>Hi<\/title>/)
    assert.equal(result.finalUrl, 'https://example.com/')
    assert.equal(result.headers['content-type'], 'text/html; charset=utf-8')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('rejects non-public URLs before any fetch', async () => {
    await assert.rejects(
      () => safeFetchHtml('http://localhost:3000/'),
      (err: unknown) => err instanceof AuditUrlError
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('follows redirects up to maxRedirects', async () => {
    fetchMock
      .mockResolvedValueOnce(htmlResponse('', { status: 302, location: 'https://example.com/final' }))
      .mockResolvedValueOnce(
        htmlResponse('<html>final</html>', { contentType: 'text/html' })
      )
    const result = await safeFetchHtml('https://example.com/', { maxBytes: 1000 })
    assert.equal(result.finalUrl, 'https://example.com/final')
    assert.match(result.html, /final/)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws when a redirect is missing its location header', async () => {
    fetchMock.mockResolvedValue(htmlResponse('', { status: 302 }))
    await assert.rejects(() => safeFetchHtml('https://example.com/'))
  })

  it('throws after exceeding maxRedirects', async () => {
    fetchMock.mockResolvedValue(
      htmlResponse('', { status: 302, location: 'https://example.com/next' })
    )
    await assert.rejects(
      () => safeFetchHtml('https://example.com/', { maxRedirects: 2 }),
      /exceeded 2 redirects/
    )
  })

  it('throws on non-2xx responses', async () => {
    fetchMock.mockResolvedValue(htmlResponse('oops', { status: 500, contentType: 'text/html' }))
    await assert.rejects(() => safeFetchHtml('https://example.com/'), /HTTP 500/)
  })

  it('throws when the destination is not an HTML document', async () => {
    fetchMock.mockResolvedValue(htmlResponse('{"a":1}', { contentType: 'application/json' }))
    await assert.rejects(() => safeFetchHtml('https://example.com/'), /HTML document/)
  })

  it('truncates bodies larger than maxBytes', async () => {
    const largeBody = '<html>' + 'x'.repeat(5000) + '</html>'
    fetchMock.mockResolvedValue(htmlResponse(largeBody, { contentType: 'text/html' }))
    const result = await safeFetchHtml('https://example.com/', { maxBytes: 1000 })
    assert.equal(result.html.length, 1000)
  })

  it('rejects the destination when DNS resolves privately', async () => {
    resolve4.mockResolvedValue(['10.0.0.1'])
    resolve6.mockResolvedValue([])
    await assert.rejects(
      () => safeFetchHtml('https://example.com/'),
      (err: unknown) => err instanceof AuditUrlError
    )
  })
})
