import { beforeEach, describe, expect, it, vi } from 'vitest'
import { load } from 'cheerio'
import { AuditUrlError } from '@/lib/audit/url'
import { runAvailabilityBinding } from '../availability-binding'
import { PublicRedirectError } from '@/lib/audit/redirect-evidence'
import { PublicResponseBodyError } from '@/lib/audit/http-evidence'

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
  it('retains an interrupted response without confirming an outage or exposing its error', async () => {
    fixture.fetch.mockRejectedValue(new PublicResponseBodyError({ statusCode: 200, finalUrl: startUrl + 'ready',
      body: '<main>Partial', headers: {}, redirects: [startUrl] },
    new TypeError('PRIVATE_ERROR_VALUE', { cause: { code: 'ECONNRESET' } })))
    await runAvailabilityBinding(input)
    expect(fixture.fetch).toHaveBeenCalledOnce()
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ attempts: [{ disposition: 'BLOCKED', reason: 'request_failed',
      detail: { status: 200, url: startUrl, finalUrl: startUrl + 'ready', source: 'public-http' } }],
    conclusive: { disposition: 'BLOCKED' } })
    expect(fixture.record.mock.calls[0][0].flag).toBeUndefined()
    expect(JSON.stringify(fixture.record.mock.calls[0][0])).not.toContain('PRIVATE_ERROR_VALUE')
    expect(fixture.browser).not.toHaveBeenCalled()
  })

  it.each([
    [503, {}, 'FAILED', 'http_unavailable', 2],
    [404, {}, 'FAILED', 'http_unavailable', 2],
    [503, { 'cf-mitigated': 'challenge' }, 'BLOCKED', 'bot_wall', 1],
    [407, {}, 'BLOCKED', 'access_restricted', 1],
    [511, {}, 'BLOCKED', 'access_restricted', 1],
  ] as const)('retains the received HTTP %s status with headers %j when its body is interrupted', async (status, headers, disposition, reason, count) => {
    fixture.fetch.mockRejectedValue(new PublicResponseBodyError({ statusCode: status, finalUrl: startUrl,
      body: null, headers, redirects: [] }, new TypeError('connection reset')))
    await runAvailabilityBinding(input)
    expect(fixture.fetch).toHaveBeenCalledTimes(count)
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({ conclusive: { disposition, reason,
      detail: { status, source: 'public-http' } } })
    expect(Boolean(fixture.record.mock.lastCall?.[0].flag)).toBe(disposition === 'FAILED')
    expect(fixture.browser).not.toHaveBeenCalled()
  })

  it('does not start a browser confirmation for an HTTP 206 public probe', async () => {
    fixture.fetch.mockResolvedValue({ statusCode: 206, body: '<h1>Ready</h1>', headers: {}, finalUrl: startUrl })
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason: 'response_unavailable',
      detail: { status: 206, source: 'public-http' } } })
    expect(fixture.browser).not.toHaveBeenCalled()
  })

  function browserResponse(status: number | null, body = '<main>Example is ready</main>', headers = {}, responseUrl = startUrl, surfaceUrl = startUrl, labelsComplete = true) {
    fixture.fetch.mockResolvedValue({ statusCode: 200, body: '<main>Example is ready</main>', headers: {}, finalUrl: startUrl })
    const $ = load(body)
    const titles = $('head > title').toArray().map(title => $(title).text())
    const headings = labelsComplete ? $('body h1').toArray().map(heading => $(heading).text()) : []
    const close = vi.fn(async () => undefined), disposeNetwork = vi.fn()
    const frame = {}, page = { evaluate: async () => ({ cues: { text: 'Example is ready', titles, headings },
      missingPageLabels: [...titles, ...headings], labelsComplete, url: surfaceUrl }), url: () => surfaceUrl,
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
    { name: 'HTTP 401', status: 401, body: '', headers: {}, reason: 'access_restricted' },
    { name: 'HTTP 403', status: 403, body: '', headers: {}, reason: 'access_restricted' },
    { name: 'HTTP 407', status: 407, body: '', headers: {}, reason: 'access_restricted' },
    { name: 'HTTP 429', status: 429, body: '', headers: {}, reason: 'access_restricted' },
    { name: 'HTTP 511', status: 511, body: '', headers: {}, reason: 'access_restricted' },
    { name: 'HTTP 503 with a human check', status: 503, body: '<h1>Verify you are human</h1>', headers: {}, reason: 'bot_wall' },
    { name: 'HTTP 503 with a challenge header', status: 503, body: '<main>Wait</main>', headers: { 'cf-mitigated': 'challenge' }, reason: 'bot_wall' },
    { name: 'HTTP 200 with a challenge title', status: 200, body: '<title>Just a moment...</title>', headers: {}, reason: 'bot_wall' },
    { name: 'HTTP 302 without a challenge', status: 302, body: '<main>Redirect</main>', headers: {}, reason: 'redirect_unfollowed' },
    { name: 'HTTP 302 with a challenge header', status: 302, body: '<main>Redirect</main>', headers: { 'cf-mitigated': 'challenge' }, reason: 'bot_wall' },
    { name: 'HTTP 206', status: 206, body: '<main>Partial content</main>', headers: {}, reason: 'response_unavailable' },
    { name: 'no browser response', status: null, body: '<main>Content without a response</main>', headers: {}, reason: 'response_unavailable' },
  ])('keeps restricted or absent browser response evidence inconclusive: $name as $reason', async ({ status, body, headers, reason }) => {
    browserResponse(status, body, headers)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason } })
    expect(fixture.record.mock.calls[0][0].flag).toBeUndefined()
    expect(fixture.fetch).toHaveBeenCalledOnce()
  })

  it('does not substitute an HTTP sign-in redirect for the default public page', async () => {
    fixture.fetch.mockResolvedValue({ statusCode: 200, body: '<title>Sign in</title>', headers: {}, finalUrl: startUrl + 'login' })
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason: 'access_restricted',
      detail: { status: 200, finalUrl: startUrl + 'login', source: 'public-http' } } })
    expect(fixture.session).not.toHaveBeenCalled()
  })

  it('checks rendered sign-in redirects and preserves explicitly configured surfaces', async () => {
    const finalUrl = startUrl + 'login'
    browserResponse(200, '<title>Sign in</title>', {}, finalUrl, finalUrl)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason: 'access_restricted',
      detail: { status: 200, finalUrl, source: 'rendered-navigation' } } })
    await runAvailabilityBinding({ ...input, config: { ...input.config, expectedText: 'Example is ready' } })
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({ conclusive: { disposition: 'SUCCEEDED', reason: 'available' } })
  })

  it('keeps browser response provenance on a successful rendered observation', async () => {
    browserResponse(200)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.calls[0][0]).toMatchObject({ conclusive: { disposition: 'SUCCEEDED', reason: 'available',
      detail: { status: 200, publicHttpStatus: 200, source: 'public-http-and-rendered-dom' } } })
  })

  it('confirms an explicit rendered missing page even when both responses have HTTP 200', async () => {
    const body = '<title>404: Page Not Found</title><main><h1>Page not found</h1></main>'
    browserResponse(200, body)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({
      attempts: [
        { disposition: 'FAILED', reason: 'missing_page', detail: { status: 200, publicHttpStatus: 200 } },
        { disposition: 'FAILED', reason: 'missing_page' },
      ],
      flag: { checkId: 'outcome-availability-failed', evidence: expect.stringContaining('HTTP 200') },
    })
    await runAvailabilityBinding({ ...input, config: { ...input.config, expectedText: 'Example is ready' } })
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({ conclusive: { disposition: 'SUCCEEDED' } })
  })

  it('does not confirm failure or recovery when rendered label collection is incomplete', async () => {
    browserResponse(200, '<title>Useful service</title><h1>' + 'x'.repeat(513) + '</h1>', {}, startUrl, startUrl, false)
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({ conclusive: { disposition: 'BLOCKED', reason: 'response_unavailable',
      detail: { status: 200, source: 'rendered-navigation' } } })
    expect(fixture.record.mock.lastCall?.[0].flag).toBeUndefined()
    expect(fixture.session).toHaveBeenCalledOnce()
  })

  it('accepts a usable rendered page when the original HTTP document is an error shell', async () => {
    browserResponse(200, '<title>How to fix a 404</title><h1>Example is ready</h1>')
    fixture.fetch.mockResolvedValue({ statusCode: 200, body: '<title>Page not found</title>', headers: {}, finalUrl: startUrl })
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({ conclusive: { disposition: 'SUCCEEDED' } })
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
  ])('confirms a recognized public failure before recording its Flag: %s as %s', async (error, reason) => {
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

  it('retains the confirmed failing redirect origin separately from the configured URL', async () => {
    const peer = 'https://edge.example.com:8443'
    fixture.fetch.mockImplementation(async (_url, options) => {
      options.onHopStart(new URL(startUrl).origin)
      options.onHopStart(peer)
      throw new AuditUrlError('No DNS records', 'DNS_NOT_FOUND')
    })
    await runAvailabilityBinding(input)
    expect(fixture.record.mock.lastCall?.[0]).toMatchObject({
      conclusive: { disposition: 'FAILED', reason: 'dns_failure', detail: { url: startUrl, finalUrl: peer, status: null } },
    })
  })

  it.each([
    ['an unavailable resolver', new AuditUrlError('Resolver unavailable', 'DNS_UNAVAILABLE')], ['a private target', new AuditUrlError('Private target')],
    ['a redirect limit without a loop', new PublicRedirectError({ statusCode: 302, finalUrl: startUrl, headers: { location: '/next' }, redirects: [] }, false)],
    ['an uncertain redirect loop', new PublicRedirectError({ statusCode: 302, finalUrl: startUrl, headers: { location: '/' }, redirects: [startUrl] }, true)],
    ['an unverifiable certificate', new TypeError('fetch failed', { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } })], ['a worker failure', new Error('Worker failed')],
  ])('retains uncertain observations for execution recovery without a website Flag: %s', async (_observation, error) => {
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
