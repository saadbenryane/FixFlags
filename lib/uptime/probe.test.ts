import { describe, expect, it, vi } from 'vitest'
import { classifyUptimeResponse, probeUptime } from './probe'
import { classifyPublicRequestFailure } from '@/lib/audit/http-failure'
import { AuditUrlError, PublicRequestError } from '@/lib/audit/url'
import { PublicResponseBodyError } from '@/lib/audit/http-evidence'
import { PublicCertificateError } from '@/lib/audit/tls-evidence'

const document = { body: '<html>Website</html>', finalUrl: 'https://example.com/', statusCode: 200, headers: {}, complete: true, redirects: [] }
describe('public HTTP reachability', () => {
  it('distinguishes origin errors from blocked observations', () => {
    expect(classifyUptimeResponse(document).result).toBe('ONLINE')
    for (const statusCode of [404, 500, 503]) expect(classifyUptimeResponse({ ...document, statusCode }).result).toBe('FAILED')
    for (const statusCode of [401, 403, 407, 429, 511]) expect(classifyUptimeResponse({ ...document, statusCode }).result).toBe('UNKNOWN')
  })
  it.each([407, 511])('retains intermediary authentication even when its HTTP %s body is interrupted', async statusCode => {
    const response = new PublicResponseBodyError({ ...document, statusCode, body: null }, new Error('Interrupted body'))
    expect(await probeUptime(document.finalUrl, async () => { throw response })).toMatchObject({
      result: 'UNKNOWN', reason: 'access_blocked', statusCode, finalUrl: document.finalUrl,
    })
  })
  it('does not treat a sign-in redirect as recovery of the monitored public page', () => {
    const signIn = { ...document, finalUrl: 'https://example.com/account/login', body: '<title>Sign in to continue</title>' }
    expect(classifyUptimeResponse({ ...signIn, redirects: ['https://example.com/pricing'] }))
      .toEqual({ result: 'UNKNOWN', reason: 'access_blocked' })
    expect(classifyUptimeResponse({ ...signIn, redirects: ['https://example.com/sign-in'] }).result).toBe('ONLINE')
    expect(classifyUptimeResponse(signIn).result).toBe('ONLINE')
    expect(classifyUptimeResponse({ ...document, finalUrl: 'https://example.com/docs/auth',
      redirects: ['https://example.com/guide'], body: '<title>Authentication guide</title>' }).result).toBe('ONLINE')
  })
  it('never treats safety refusals or internal failures as website outages', () => {
    expect(classifyPublicRequestFailure(new AuditUrlError('Private target')).result).toBe('UNKNOWN')
    expect(classifyPublicRequestFailure(new Error('Worker failed')).result).toBe('UNKNOWN')
    expect(classifyPublicRequestFailure(new Error('Certificate has expired')).result).toBe('UNKNOWN')
    expect(classifyPublicRequestFailure(new AuditUrlError('No DNS records', 'DNS_NOT_FOUND'))).toMatchObject({ result: 'FAILED', reason: 'dns_failure' })
    expect(classifyPublicRequestFailure(new AuditUrlError('DNS unavailable', 'DNS_UNAVAILABLE')).result).toBe('UNKNOWN')
    expect(classifyPublicRequestFailure(new PublicRequestError('Response timeout'))).toMatchObject({ result: 'FAILED', reason: 'response_timeout' })
    expect(classifyPublicRequestFailure(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }))).toMatchObject({ result: 'FAILED', reason: 'connection_failed' })
    for (const socket of [undefined, { bytesWritten: 0 }])
      expect(classifyPublicRequestFailure(new TypeError('fetch failed', { cause: { code: 'UND_ERR_SOCKET', socket } })))
        .toEqual({ result: 'UNKNOWN', reason: 'probe_unavailable' })
  })
  it('uses bounded public fetching without running browser verification', async () => {
    const fetch = vi.fn(async () => document)
    expect(await probeUptime(document.finalUrl, fetch)).toMatchObject({ result: 'ONLINE', statusCode: 200, finalUrl: document.finalUrl })
    expect(fetch).toHaveBeenCalledWith(document.finalUrl, { timeoutMs: 8000, maxBytes: 64_000, maxRedirects: 5, publicOnly: true,
      onRequestStart: expect.any(Function), onHopStart: expect.any(Function) })
  })
  it.each(['ECONNRESET', 'ETIMEDOUT', 'UND_ERR_HEADERS_TIMEOUT'])('does not mistake interrupted response content for a pre-response outage: %s', async code => {
    const failure = new TypeError('Interrupted body', { cause: { code } })
    expect(classifyPublicRequestFailure(failure).result).toBe('FAILED')
    const partial = new PublicResponseBodyError({ body: '<h1>Partial content', statusCode: 200,
      finalUrl: document.finalUrl, headers: { 'content-type': 'text/html' }, redirects: [] }, failure)
    expect(await probeUptime(document.finalUrl, async () => { throw partial }))
      .toMatchObject({ result: 'UNKNOWN', statusCode: 200, finalUrl: document.finalUrl })
  })
  it.each([
    ['CERT_HAS_EXPIRED', 'certificate_expired'], ['CERT_NOT_YET_VALID', 'certificate_not_yet_valid'],
    ['ERR_TLS_CERT_ALTNAME_INVALID', 'certificate_name_mismatch'], ['HOSTNAME_MISMATCH', 'certificate_name_mismatch'],
    ['DEPTH_ZERO_SELF_SIGNED_CERT', 'certificate_untrusted'], ['SELF_SIGNED_CERT_IN_CHAIN', 'certificate_untrusted'],
    ['CERT_REVOKED', 'certificate_revoked'], ['CERT_SIGNATURE_FAILURE', 'certificate_invalid'],
    ['ERROR_IN_CERT_NOT_BEFORE_FIELD', 'certificate_invalid'], ['ERROR_IN_CERT_NOT_AFTER_FIELD', 'certificate_invalid'],
  ])('records the recognized peer-certificate failure %s without inventing an HTTP response', async (code, reason) => {
    const error = new TypeError('fetch failed', { cause: Object.assign(new Error('Certificate detail'), { code }) })
    expect(classifyPublicRequestFailure(error)).toEqual({ result: 'FAILED', reason })
    expect(classifyPublicRequestFailure(Object.assign(new Error('Direct TLS failure'), { code }))).toEqual({ result: 'FAILED', reason })
    expect(await probeUptime(document.finalUrl, async () => { throw error }))
      .toMatchObject({ result: 'FAILED', reason, statusCode: null, finalUrl: null })
  })
  it('retains the HTTPS peer after a redirect without inventing a response or retaining URL secrets', async () => {
    const error = new PublicCertificateError('https://edge.example.com:8443/private/path?token=secret#private', [document.finalUrl],
      { kind: 'tls-certificate', code: 'CERT_HAS_EXPIRED' }, Object.assign(new Error('Transport wrapper'), { code: 'ERR_UNKNOWN' }))
    expect(await probeUptime(document.finalUrl, async () => { throw error })).toMatchObject({
      result: 'FAILED', reason: 'certificate_expired', statusCode: null, finalUrl: 'https://edge.example.com:8443',
    })
  })
  it.each(['ERR_OSSL_PEM_NO_START_LINE', 'ERR_TLS_INVALID_PROTOCOL_METHOD', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_SSL_WRONG_VERSION_NUMBER'])(
    'retains ambiguous trust and local TLS configuration errors as unknown: %s', code => {
      expect(classifyPublicRequestFailure(new TypeError('fetch failed', { cause: { code } })))
        .toEqual({ result: 'UNKNOWN', reason: 'probe_unavailable' })
    })
})
