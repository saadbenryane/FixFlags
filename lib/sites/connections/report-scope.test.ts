import { afterEach, describe, expect, it, vi } from 'vitest'
import { liveGoogleClient } from './google'
import { analyticsPageFactScope, readAnalyticsPageFactScope, analyticsReportScope, analyticsWatchedPagePaths, readAnalyticsReportScope, searchReportScope, searchPageFilter, searchFactScope, readSearchFactScope } from './report-scope'

afterEach(vi.unstubAllGlobals)
describe('Search Console Site report scope', () => {
  it('filters the exact hostname aliases before the provider selects top page/query rows', async () => {
    const transport = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ rows: [{ keys: ['https://shop.example/pricing', 'plans'], impressions: 10 }] })))
    vi.stubGlobal('fetch', transport)
    const scope = searchReportScope('www.shop.example', 'sc-domain:shop.example')
    expect(await liveGoogleClient().querySearch('fixture-access', scope, { startDate: '2026-09-01', endDate: '2026-09-28' }))
      .toEqual([{ keys: ['https://shop.example/pricing', 'plans'], impressions: 10 }])
    const body = JSON.parse((transport.mock.calls[0][1] as RequestInit).body as string)
    expect(body).toMatchObject({ dimensions: ['page', 'query'], rowLimit: 25,
      dimensionFilterGroups: [{ groupType: 'and', filters: [{ dimension: 'page', operator: 'includingRegex', expression: searchPageFilter(scope) }] }] })
    const filter = new RegExp(body.dimensionFilterGroups[0].filters[0].expression)
    for (const url of ['https://shop.example/pricing', 'http://www.shop.example/', 'https://shop.example:444/path']) expect(filter.test(url)).toBe(true)
    for (const url of ['https://checkout.shop.example/pricing', 'https://shop.example.evil.test/', 'https://shopXexample/', 'https://other.example/shop.example/', 'https://user@shop.example/']) expect(filter.test(url)).toBe(false)
  })
  it('requires source URL, owning host and current property when reading a scoped fact', () => {
    const scope = searchReportScope('shop.example', 'https://shop.example/blog/')
    const fact = searchFactScope(scope, 'https://shop.example/blog/post')!
    expect(readSearchFactScope(fact, scope.propertyId, 'www.shop.example')).toEqual(fact)
    expect(readSearchFactScope(fact, 'sc-domain:shop.example', 'shop.example')).toBeNull()
    expect(readSearchFactScope(fact, scope.propertyId, 'checkout.shop.example')).toBeNull()
    expect(readSearchFactScope({ ...fact, pageUrl: 'https://shop.example/about' }, scope.propertyId, 'shop.example')).toBeNull()
    expect(readSearchFactScope({ ...fact, pageUrl: 'https://other.example/blog/post' }, scope.propertyId, 'shop.example')).toBeNull()
    expect(readSearchFactScope(null, scope.propertyId, 'shop.example')).toBeNull()
  })
})
describe('Analytics Site report scope', () => {
  it('keeps bare/www identity without granting sibling or unrelated domains', () => {
    const scope = analyticsReportScope('www.shop.example', 'properties/123')
    expect(scope.hostnames).toEqual(['shop.example', 'www.shop.example'])
    expect(readAnalyticsReportScope(scope, scope.propertyId, 'shop.example')).toEqual(scope)
    expect(readAnalyticsReportScope(scope, 'properties/other', 'shop.example')).toBeNull()
    expect(readAnalyticsReportScope(scope, scope.propertyId, 'checkout.shop.example')).toBeNull()
    expect(readAnalyticsReportScope(null, scope.propertyId, 'shop.example')).toBeNull()
  })
  it('requires the actual reported page dimension before attributing Analytics to a page', () => {
    const scope = analyticsReportScope('shop.example', 'properties/123')
    const fact = analyticsPageFactScope(scope, '/pricing/')!
    expect(readAnalyticsPageFactScope(fact, scope.propertyId, 'shop.example')).toEqual(fact)
    expect(readAnalyticsPageFactScope(scope, scope.propertyId, 'shop.example')).toBeNull()
    expect(readAnalyticsReportScope(scope, scope.propertyId, 'shop.example')).toEqual(scope)
    expect(readAnalyticsPageFactScope(fact, 'properties/456', 'shop.example')).toBeNull()
    expect(readAnalyticsPageFactScope(fact, scope.propertyId, 'other.example')).toBeNull()
    for (const path of ['(not set)', 'https://other.example/pricing', '/pricing?query=one', '/pricing#section'])
      expect(analyticsPageFactScope(scope, path)).toBeNull()
  })
  it('sends the hostname filter before page aggregation and keeps missing metrics unknown', async () => {
    const request = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ reports: [{ dimensionHeaders: [{ name: 'pagePath' }], metricHeaders: [{ name: 'screenPageViews' }, { name: 'sessions' }], rows: [
      { dimensionValues: [{ value: '/pricing' }], metricValues: [{ value: '24' }, { value: '12' }] },
      { dimensionValues: [{ value: '/missing' }], metricValues: [] },
    ] }, { metricHeaders: [{ name: 'activeUsers' }, { name: 'screenPageViews' }, { name: 'sessions' }], rows: [{ metricValues: [{ value: '3' }, { value: '40' }, { value: '8' }] }] }] }), { status: 200 }))
    vi.stubGlobal('fetch', request)
    const scope = analyticsReportScope('shop.example', 'properties/123')
    const rows = await liveGoogleClient().queryAnalytics('fixture-access', scope, { startDate: '2026-09-01', endDate: '2026-09-28' })
    expect(request.mock.calls[0][0]).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:batchRunReports')
    const payload = JSON.parse((request.mock.calls[0][1] as RequestInit).body as string)
    expect(payload.requests[0]).toMatchObject({
      dimensions: [{ name: 'pagePath' }], metrics: [{ name: 'sessions' }, { name: 'screenPageViews' }], limit: 25,
      dimensionFilter: { filter: { fieldName: 'hostName', inListFilter: { values: ['shop.example', 'www.shop.example'], caseSensitive: false } } },
      orderBys: [{ metric: { metricName: 'sessions' }, desc: true }, { dimension: { dimensionName: 'pagePath' } }],
    })
    expect(payload.requests[1]).toMatchObject({ metrics: [{ name: 'sessions' }, { name: 'activeUsers' }, { name: 'screenPageViews' }], limit: 1,
      dimensionFilter: payload.requests[0].dimensionFilter, dateRanges: payload.requests[0].dateRanges })
    expect(payload.requests[1].dimensions).toBeUndefined()
    expect(rows).toEqual({ pages: [{ pagePath: '/pricing', sessions: 12, pageViews: 24 }, { pagePath: '/missing', sessions: undefined, pageViews: undefined }], audience: { sessions: 8, activeUsers: 3, pageViews: 40 } })
  })
  it('selects watched paths from owned URLs, keeps case and excludes other origins and malformed pages', () => {
    const scope = analyticsReportScope('shop.example', 'properties/123')
    expect(analyticsWatchedPagePaths('https://shop.example/Entry?secret=fixture', [
      'https://www.shop.example/pricing/', 'https://checkout.shop.example/foreign', 'https://shop.example.evil.test/foreign',
      '/relative', 'https://user@shop.example/private', 'ftp://shop.example/foreign', 'https://shop.example/Entry#section',
    ], scope)).toEqual(['/Entry', '/pricing/'])
    expect(analyticsWatchedPagePaths('https://shop.example/', Array.from({ length: 100 }, (_, i) => `https://shop.example/page-${i}`), scope)).toHaveLength(25)
  })
  it('rejects a malformed success response without manufacturing an empty report', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 200 })))
    await expect(liveGoogleClient().queryAnalytics('fixture-access', analyticsReportScope('shop.example', 'properties/123'),
      { startDate: '2026-09-01', endDate: '2026-09-28' })).rejects.toThrow('Analytics report columns are unavailable')
  })
})
