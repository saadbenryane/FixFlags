import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AuditUrlError } from '@/lib/audit/url'
import { runAvailabilityBinding } from '../availability-binding'
import { PublicRedirectError } from '@/lib/audit/redirect-evidence'

const fixture = vi.hoisted(() => ({ fetch: vi.fn(), record: vi.fn(), browser: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/audit/url', async original => ({ ...await original<typeof import('@/lib/audit/url')>(), safeFetchDocument: fixture.fetch }))
vi.mock('@/lib/audit/screenshot', () => ({ getBrowser: fixture.browser }))
vi.mock('@/lib/audit/browser/page-session', () => ({ createAuditPage: fixture.session }))
vi.mock('../binding-evidence', () => ({ recordBindingEvidence: fixture.record, recordExecution: vi.fn() }))
const startUrl = 'https://example.com/'
const input = { auditId: 'audit', outcomeId: 'availability', bindingKey: 'page-loads', bindingVersion: 1,
  startUrl, config: { startUrl, expectedSelector: 'body' } }
beforeEach(() => { vi.clearAllMocks(); fixture.fetch.mockReset() })

describe('availability transport evidence', () => {
  function browserResponse(status: number | null, body = '<main>Example is ready</main>', headers = {}, responseUrl = startUrl, surfaceUrl = startUrl) {
    fixture.fetch.mockResolvedValue({ statusCode: 200, body: '<main>Example is ready</main>', headers: {}, finalUrl: startUrl })
    const close = vi.fn(async () => undefined), disposeNetwork = vi.fn()
    const frame = {}, page = { evaluate: async () => ({ text: 'Example is ready', html: body, url: surfaceUrl }), url: () => surfaceUrl,
      context: () => ({ close }), mainFrame: () => frame, off: vi.fn(),
      on: (_: string, listener: (response: unknown) => void) => {
        if (status !== null) listener({ status: () => status, headers: () => headers, url: () => responseUrl,
          frame: () => frame, request: () => ({ isNavigationRequest: () => true }) })
      } }
    fixture.session.mockImplementation(async (_browser, _url, options) => {
      options.onNavigationStart(page, Date.now())
      return { httpStatus: status ?? 200, responseHeaders: headers, safetyRestrictions: [], disposeNetwork, page }
    })
    return { close, disposeNetwork }
  }

  it.each([404, 500, 503])('confirms a browser HTTP %s independently of the successful HTTP probe', async status => {
    const cleanup = browserResponse(status)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ attempts: [
      { disposition: 'FAILED', reason: 'http_unavailable', detail: { status, source: 'rendered-navigation', publicHttpStatus: 200 } },
      { disposition: 'FAILED', reason: 'http_unavailable' },
    ], flag: { checkId: 'outcome-availability-failed' } })
    expect(fixture.fetch).toHaveBeenCalledTimes(2)
    expect(fixture.session).toHaveBeenCalledWith(undefined, startUrl, expect.objectContaining({ retainErrorDocument: true }))
    expect(cleanup.close).toHaveBeenCalledTimes(2)
    expect(cleanup.disposeNetwork).toHaveBeenCalledTimes(2)
  })

  it.each([
    { status: 401, body: '', headers: {}, reason: 'access_restricted' },
    { status: 403, body: '', headers: {}, reason: 'access_restricted' },
    { status: 429, body: '', headers: {}, reason: 'access_restricted' },
    { status: 503, body: '<h1>Verify you are human</h1>', headers: {}, reason: 'bot_wall' },
    { status: 503, body: '<main>Wait</main>', headers: { 'cf-mitigated': 'challenge' }, reason: 'bot_wall' },
    { status: 200, body: '<title>Just a moment...</title>', headers: {}, reason: 'bot_wall' },
    { status: 302, body: '<main>Redirect</main>', headers: {}, reason: 'redirect_unfollowed' },
    { status: null, body: '<main>Content without a response</main>', headers: {}, reason: 'response_unavailable' },
  ])('keeps restricted or absent browser response evidence inconclusive: $status $reason', async ({ status, body, headers, reason }) => {
    browserResponse(status, body, headers)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason } })
    expect(fixture.record.mock.calls[0][0].flag).toBeUndefined()
    expect(fixture.fetch).toHaveBeenCalledOnce()
  })

  it('keeps browser response provenance on a successful rendered observation', async () => {
    browserResponse(200)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'SUCCEEDED', reason: 'available',
      detail: { status: 200, publicHttpStatus: 200, source: 'public-http-and-rendered-dom' } } })
  })

  it('cannot borrow a successful response from a different document', async () => {
    browserResponse(200, '<main>Example is ready</main>', {}, startUrl + 'other', startUrl + 'current')
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason: 'response_unavailable' } })
    expect(fixture.record.mock.calls[0][0].flag).toBeUndefined()
  })

  it('retains a response for fragment navigation within that document', async () => {
    browserResponse(200, '<main>Example is ready</main>', {}, startUrl, startUrl + '#details')
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'SUCCEEDED', reason: 'available' } })
  })

  it.each([
    [new AuditUrlError('No DNS records', 'DNS_NOT_FOUND'), 'dns_failure'],
    [new PublicRedirectError({ statusCode: 302, finalUrl: startUrl, headers: { location: '/' }, redirects: [startUrl] }, false), 'redirect_loop'],
    [new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }), 'connection_failed'],
    [new TypeError('fetch failed', { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } }), 'response_timeout'],
    [new TypeError('fetch failed', { cause: { code: 'CERT_HAS_EXPIRED', private: 'PRIVATE_ERROR_VALUE' } }), 'certificate_expired'],
  ])('confirms a recognized public failure before recording its Flag: %s', async (error, reason) => {
    fixture.fetch.mockRejectedValue(error)
    await runAvailabilityBinding(input)
    expect(fixture.fetch).toHaveBeenCalledTimes(2)
    expect(fixture.record).toHaveBeenCalledOnce()
    expect(fixture.record.mock.calls[0][0]).toMatchObject({
      attempts: [{ disposition: 'FAILED', reason }, { disposition: 'FAILED', reason }],
      conclusive: { disposition: 'FAILED', reason }, flag: { checkId: 'outcome-availability-failed' },
    })
    expect(JSON.stringify(fixture.record.mock.calls[0][0])).not.toContain('PRIVATE_ERROR_VALUE')
    expect(fixture.browser).not.toHaveBeenCalled()
  })

  it.each([
    new AuditUrlError('Resolver unavailable', 'DNS_UNAVAILABLE'), new AuditUrlError('Private target'),
    new PublicRedirectError({ statusCode: 302, finalUrl: startUrl, headers: { location: '/next' }, redirects: [] }, false),
    new PublicRedirectError({ statusCode: 302, finalUrl: startUrl, headers: { location: '/' }, redirects: [startUrl] }, true),
    new TypeError('fetch failed', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } }), new Error('Worker failed'),
  ])('retains uncertain observations for execution recovery without a website Flag: %s', async error => {
    fixture.fetch.mockRejectedValue(error)
    await runAvailabilityBinding(input)
    expect(fixture.fetch).toHaveBeenCalledOnce()
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason: 'request_failed' } })
    expect(fixture.record.mock.calls[0][0].flag).toBeUndefined()
    expect(fixture.browser).not.toHaveBeenCalled()
  })

  it('withholds a Flag when the confirmation becomes uncertain', async () => {
    fixture.fetch.mockRejectedValueOnce(new AuditUrlError('No DNS records', 'DNS_NOT_FOUND'))
      .mockRejectedValueOnce(new AuditUrlError('Resolver unavailable', 'DNS_UNAVAILABLE'))
    await runAvailabilityBinding(input)
    expect(fixture.fetch).toHaveBeenCalledTimes(2)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ attempts: [
      { disposition: 'FAILED', reason: 'dns_failure' }, { disposition: 'BLOCKED', reason: 'request_failed' },
    ], conclusive: { disposition: 'BLOCKED', reason: 'request_failed' } })
    expect(fixture.record.mock.calls[0][0].flag).toBeUndefined()
  })
})
