import { afterEach, describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { inspectSearchUrl, querySearchAnalytics, SearchConsoleError } from '@/lib/integrations/google-search-console'
import { searchConsoleReportingPeriod } from '@/lib/integrations/search-console-report'
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
    expect(JSON.parse(String(request[1].body))).toMatchObject({ aggregationType: 'byPage', dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: 'https://example.com/article' }] }] })
  })
  it('keeps the 28-day window on Pacific calendar dates through the daylight-saving boundary', () => {
    expect(searchConsoleReportingPeriod(new Date('2026-11-02T07:30:00Z'))).toEqual({ startDate: '2026-10-04', endDate: '2026-10-31' })
    expect(searchConsoleReportingPeriod(new Date('2026-11-02T08:30:00Z'))).toEqual({ startDate: '2026-10-05', endDate: '2026-11-01' })
  })
  it('rejects malformed or incomplete provider rows instead of emitting a CTR recommendation', async () => {
    const row = { keys: ['useful service', 'https://example.com/article'], clicks: 1, impressions: 100, ctr: 0.01, position: 4 }
    for (const report of [
      { rows: [{ ...row, ctr: 2 }] }, { rows: [{ ...row, impressions: 2_147_483_648 }] }, { rows: [row, row] },
      { rows: [{ ...row, keys: ['useful service'] }] }, { rows: [row], metadata: { first_incomplete_date: '2026-09-28' } },
    ]) {
      vi.stubGlobal('fetch', vi.fn(async () => Response.json(report)))
      await expect(querySearchAnalytics('token', 'https://example.com/', '2026-09-01', '2026-09-28',
        ['query', 'page'], 250, 0, 'https://example.com/article')).rejects.toMatchObject({ code: 'MALFORMED_PROVIDER_RESPONSE' })
    }
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
