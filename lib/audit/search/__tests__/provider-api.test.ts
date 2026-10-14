import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { inspectSearchUrl, querySearchAnalytics, SearchConsoleError } from '@/lib/integrations/google-search-console'
import { searchPropertyCoversUrl } from '@/lib/sites/connections/report-scope'
afterEach(() => vi.unstubAllGlobals())

describe('Search Console transport and property contracts', () => {
  it('preserves separate indexing and rich-results sections', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ inspectionResult: {
      indexStatusResult: { verdict: 'PASS', pageFetchState: 'SUCCESSFUL', lastCrawlTime: '2026-10-01T12:00:00Z' },
      richResultsResult: { verdict: 'FAIL', detectedItems: [{ richResultType: 'Product' }] },
    } }))))
    expect(await inspectSearchUrl('private-token', 'sc-domain:example.com', 'https://example.com/'))
      .toMatchObject({ indexStatusResult: { verdict: 'PASS', pageFetchState: 'SUCCESSFUL' }, richResultsResult: { verdict: 'FAIL' } })
  })
  it('uses an exact page filter rather than site-wide top rows', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ rows: [] })))
    vi.stubGlobal('fetch', fetch)
    await querySearchAnalytics('token', 'https://example.com/', '2026-09-01', '2026-09-28', ['query', 'page'], 250, 0, 'https://example.com/article')
    const request = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(JSON.parse(String(request[1].body)).dimensionFilterGroups).toEqual([{ filters: [{ dimension: 'page', operator: 'equals', expression: 'https://example.com/article' }] }])
  })
  it('distinguishes authentication, permission, quota, and malformed responses', async () => {
    for (const [status, code] of [[401, 'AUTH_EXPIRED'], [403, 'PERMISSION_REFUSED'], [429, 'PROVIDER_QUOTA'], [503, 'PROVIDER_UNAVAILABLE']] as const) {
      vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status })))
      await expect(inspectSearchUrl('token', 'sc-domain:example.com', 'https://example.com/')).rejects.toMatchObject({ code })
    }
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"unexpected":true}')))
    await expect(inspectSearchUrl('token', 'sc-domain:example.com', 'https://example.com/')).rejects.toBeInstanceOf(SearchConsoleError)
  })
  it('rejects mismatching protocol, host, port, and URL-prefix path', () => {
    expect(searchPropertyCoversUrl('https://example.com/blog/', 'https://example.com/blog/post')).toBe(true)
    for (const url of ['http://example.com/blog/post', 'https://www.example.com/blog/post', 'https://example.com:444/blog/post', 'https://example.com/about'])
      expect(searchPropertyCoversUrl('https://example.com/blog/', url)).toBe(false)
    expect(searchPropertyCoversUrl('sc-domain:example.com', 'https://shop.example.com/product')).toBe(true)
    expect(searchPropertyCoversUrl('sc-domain:example.com', 'https://notexample.com/')).toBe(false)
  })
})
