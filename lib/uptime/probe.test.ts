import { describe, expect, it, vi } from 'vitest'
import { classifyUptimeError, classifyUptimeResponse, probeUptime } from './probe'
import { AuditUrlError, PublicRequestError } from '@/lib/audit/url'

const document = { body: '<html>Website</html>', finalUrl: 'https://example.com/', statusCode: 200, headers: {}, complete: true, redirects: [] }
describe('public HTTP reachability', () => {
  it('distinguishes origin errors from blocked observations', () => {
    expect(classifyUptimeResponse(document).result).toBe('ONLINE')
    for (const statusCode of [404, 500, 503]) expect(classifyUptimeResponse({ ...document, statusCode }).result).toBe('FAILED')
    for (const statusCode of [401, 403, 429]) expect(classifyUptimeResponse({ ...document, statusCode }).result).toBe('UNKNOWN')
  })
  it('never treats safety refusals or internal failures as website outages', () => {
    expect(classifyUptimeError(new AuditUrlError('Private target')).result).toBe('UNKNOWN')
    expect(classifyUptimeError(new Error('Worker failed')).result).toBe('UNKNOWN')
    expect(classifyUptimeError(new AuditUrlError('No DNS records', 'DNS_NOT_FOUND'))).toMatchObject({ result: 'FAILED', reason: 'dns_failure' })
    expect(classifyUptimeError(new AuditUrlError('DNS unavailable', 'DNS_UNAVAILABLE')).result).toBe('UNKNOWN')
    expect(classifyUptimeError(new PublicRequestError('Response timeout'))).toMatchObject({ result: 'FAILED', reason: 'response_timeout' })
    expect(classifyUptimeError(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }))).toMatchObject({ result: 'FAILED', reason: 'connection_failed' })
  })
  it('uses bounded public fetching without running browser verification', async () => {
    const fetch = vi.fn(async () => document)
    expect(await probeUptime(document.finalUrl, fetch)).toMatchObject({ result: 'ONLINE', statusCode: 200, finalUrl: document.finalUrl })
    expect(fetch).toHaveBeenCalledWith(document.finalUrl, { timeoutMs: 8000, maxBytes: 64_000, maxRedirects: 5, publicOnly: true,
      onRequestStart: expect.any(Function) })
  })
})
