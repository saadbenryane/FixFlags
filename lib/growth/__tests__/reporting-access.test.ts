import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { auth, gaReport, searchReport } = vi.hoisted(() => ({ auth: vi.fn(), gaReport: vi.fn(), searchReport: vi.fn() }))
vi.mock('googleapis', () => ({ google: {
  analyticsdata: () => ({ properties: { runReport: gaReport } }),
  searchconsole: () => ({ searchanalytics: { query: searchReport } }),
} }))
vi.mock('../google-auth', () => ({ googleServiceAccount: auth }))
import { inspectFixFlagsReporting } from '../reporting-access'

const finalizedDates = Array.from({ length: 28 }, (_, index) => ({
  keys: [new Date(Date.UTC(2026, 9, 9 + index)).toISOString().slice(0, 10)], clicks: 0, impressions: 1,
}))

describe('read-only FixFlags reporting inspection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv('GA4_PROPERTY_ID', '541892062')
    vi.stubEnv('GSC_PROPERTY', 'sc-domain:fixflags.com')
    auth.mockResolvedValue({ private_key: 'synthetic-private-secret' })
    gaReport.mockResolvedValue({ data: {
      metadata: { timeZone: 'Africa/Casablanca', subjectToThresholding: true },
      metricHeaders: [{ name: 'sessions' }, { name: 'unexpected-private-field' }],
      rows: [{ metricValues: [{ value: '12' }, { value: 'secret@example.test' }] }],
    } })
    searchReport.mockResolvedValue({ data: { rows: [{ keys: ['private-search-query'], clicks: 2, impressions: 20, ctr: 0.1, position: 4 }] } })
  })
  afterEach(() => vi.unstubAllEnvs())

  it('requests only aggregate reports with read-only scopes and suppresses private fields', async () => {
    const result = await inspectFixFlagsReporting('2026-09-15', '2026-10-12')
    expect(auth).toHaveBeenCalledWith([
      'https://www.googleapis.com/auth/analytics.readonly', 'https://www.googleapis.com/auth/webmasters.readonly',
    ])
    expect(gaReport.mock.calls[0][0].requestBody.dimensions).toBeUndefined()
    expect(gaReport).toHaveBeenCalledTimes(1)
    expect(result).not.toHaveProperty('aiReferralSessions')
    expect(result).not.toHaveProperty('routePrivacy')
    expect(searchReport.mock.calls[0][0].requestBody).toMatchObject({ dimensions: [], rowLimit: 1, dataState: 'final', type: 'web' })
    expect(result.ga4).toMatchObject({ status: 'report-read-succeeded', providerLimited: true, metrics: { sessions: 12 } })
    expect(result.searchConsole).toMatchObject({ status: 'report-read-succeeded', metrics: { clicks: 2, impressions: 20 } })
    expect(result.databaseWritten).toBe(false)
    for (const secret of ['synthetic-private-secret', 'private-journey-id', 'private-search-query', 'secret@example.test']) expect(JSON.stringify(result)).not.toContain(secret)
  })

  it('preserves a working provider result without serializing the other provider exception', async () => {
    gaReport.mockRejectedValue(new Error('signed credential synthetic-secret'))
    const result = await inspectFixFlagsReporting('2026-09-15', '2026-10-12')
    expect(result.ga4).toEqual({ status: 'report-read-failed' })
    expect(result.searchConsole.status).toBe('report-read-succeeded')
    expect(JSON.stringify(result)).not.toContain('synthetic-secret')
  })

  it('does not substitute zero metrics for an empty report', async () => {
    gaReport.mockResolvedValue({ data: {} })
    searchReport.mockResolvedValue({ data: {} })
    const result = await inspectFixFlagsReporting('2026-09-15', '2026-10-12')
    expect(result.ga4).toMatchObject({ metrics: {} })
    expect(result.searchConsole).toMatchObject({ metrics: null })
  })

  it('reads the exact canonical guide and separates landing sessions, views and Analyze clicks', async () => {
    gaReport.mockResolvedValueOnce({ data: {
      metadata: { timeZone: 'Africa/Casablanca' },
      metricHeaders: [{ name: 'screenPageViews' }],
      rows: [{ metricValues: [{ value: '15' }] }],
    } }).mockResolvedValueOnce({ data: {
      metadata: { timeZone: 'Africa/Casablanca', dataLossFromOtherRow: true },
      metricHeaders: [{ name: 'eventCount' }],
      rows: [{ metricValues: [{ value: '0' }] }],
    } }).mockResolvedValueOnce({ data: {
      metadata: { timeZone: 'Africa/Casablanca' },
      metricHeaders: [{ name: 'sessions' }],
      rows: [{ metricValues: [{ value: '7' }] }],
    } })
    searchReport.mockResolvedValueOnce({ data: { responseAggregationType: 'byProperty', rows: finalizedDates.toReversed() } })
      .mockResolvedValueOnce({ data: { responseAggregationType: 'byPage', rows: [{ clicks: 1, impressions: 8, ctr: .125, position: 9 }] } })
    const path = '/guides/website-online-but-not-working'
    const result = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'website-online-but-not-working')
    const filters = (call: number) => gaReport.mock.calls[call][0].requestBody.dimensionFilter.andGroup.expressions
      .map(({ filter }: { filter: { fieldName: string; stringFilter: { matchType: string; caseSensitive: boolean; value: string } } }) =>
        [filter.fieldName, filter.stringFilter.value, filter.stringFilter.matchType, filter.stringFilter.caseSensitive])
    expect(filters(0)).toEqual([['hostName', 'fixflags.com', 'EXACT', true],
      ['streamId', '15085844419', 'EXACT', true], ['pagePath', path, 'EXACT', true]])
    expect(filters(1)).toEqual([...filters(0), ['eventName', 'guide_analyze_clicked', 'EXACT', true]])
    expect(filters(2)).toEqual([...filters(0).slice(0, 2), ['landingPage', path, 'EXACT', true]])
    expect(gaReport.mock.calls[2][0].requestBody.metrics).toEqual([{ name: 'sessions' }])
    expect(gaReport.mock.calls.every(([request]) => request.requestBody.dimensions === undefined)).toBe(true)
    expect(searchReport.mock.calls[0][0]).toEqual({ siteUrl: 'sc-domain:fixflags.com', requestBody: {
      startDate: '2026-10-09', endDate: '2026-11-05', dimensions: ['date'], rowLimit: 28,
      aggregationType: 'byProperty', dataState: 'final', type: 'web',
    } })
    expect(searchReport.mock.calls[1][0].requestBody).toMatchObject({
      dimensions: [], aggregationType: 'auto', dataState: 'final',
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'equals', expression: `https://fixflags.com${path}` }] }],
    })
    expect(result).toMatchObject({
      guide: { path, ga4WebStreamId: '15085844419' },
      ga4: { metrics: { screenPageViews: 15 } },
      analyzeClicks: { eventName: 'guide_analyze_clicked', status: 'report-read-succeeded', count: 0, providerLimited: true },
      landingSessions: { dimension: 'landingPage', status: 'report-read-succeeded', count: 7, providerLimited: false },
      searchConsole: { pageAggregationConfirmed: true, metrics: { clicks: 1, impressions: 8 },
        finalizedWindow: { status: 'confirmed', expectedDays: 28, observedDays: 28, firstMissingDate: null } },
    })
  })

  it('keeps a missing landing-session row distinct from zero and isolates provider failure', async () => {
    gaReport.mockResolvedValue({ data: {} })
    const inspect = () => inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'guides-index')
    expect(await inspect()).toMatchObject({ landingSessions: { status: 'report-read-succeeded', count: null } })
    gaReport.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: {} })
      .mockRejectedValueOnce(new Error('private response for landing report'))
    const failed = await inspect()
    expect(failed).toMatchObject({ ga4: { status: 'report-read-succeeded' },
      landingSessions: { status: 'report-read-failed', count: null } })
    expect(JSON.stringify(failed)).not.toContain('private response')
  })

  it.each([undefined, 'website-online-but-not-working'])(
    'requests only a fixed AI referral aggregate for %s when opted in',
    async guide => {
      gaReport.mockResolvedValue({ data: {} })
      const referralReport = { data: { metricHeaders: [{ name: 'sessions' }], rows: [{ metricValues: [{ value: '2' }] }] } }
      for (let index = 0; index < (guide ? 3 : 1); index++) {
        gaReport.mockResolvedValueOnce({ data: {} })
      }
      gaReport.mockResolvedValueOnce(referralReport)
      const report = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', guide, { aiReferrals: true })
      const { requestBody } = gaReport.mock.lastCall![0]
      expect(requestBody.dimensions).toBeUndefined()
      expect(requestBody.metrics).toEqual([{ name: 'sessions' }])
      expect(requestBody.dimensionFilter.andGroup.expressions.map(({ filter }: { filter: unknown }) => filter)).toEqual([
        { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', caseSensitive: true, value: 'fixflags.com' } },
        { fieldName: 'streamId', stringFilter: { matchType: 'EXACT', caseSensitive: true, value: '15085844419' } },
        ...(guide ? [{ fieldName: 'landingPage', stringFilter: { matchType: 'EXACT', caseSensitive: true, value: `/guides/${guide}` } }] : []),
        { fieldName: 'sessionMedium', stringFilter: { matchType: 'EXACT', caseSensitive: true, value: 'referral' } },
        { fieldName: 'sessionSource', inListFilter: {
          caseSensitive: true, values: ['chatgpt.com', 'claude.ai', 'copilot.microsoft.com', 'perplexity.ai'],
        } },
      ])
      expect(report.aiReferralSessions).toMatchObject({ method: 'ga4-session-source-referral-v1',
        ga4WebStreamId: '15085844419', scope: guide ? 'guide-landing-page' : 'sitewide',
        status: 'report-read-succeeded', providerLimited: false, count: 2 })
    },
  )

  it('leaves an empty AI referral report unavailable', async () => {
    gaReport.mockResolvedValue({ data: {} })
    const report = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', undefined, { aiReferrals: true })
    expect(report.aiReferralSessions).toMatchObject({ status: 'report-read-succeeded', count: null })
  })

  it('checks fixed route families with an ungrouped homepage control and emits only pageview presence', async () => {
    const metricHeaders = [{ name: 'screenPageViews' }]
    gaReport.mockResolvedValueOnce({ data: {} })
      .mockResolvedValueOnce({ data: { metricHeaders, rows: [{ metricValues: [{ value: '3127' }] }] } })
      .mockResolvedValueOnce({ data: { metricHeaders, rows: [] } })
      .mockResolvedValueOnce({ data: { metricHeaders, rows: [{ metricValues: [{ value: '0' }] }] } })
      .mockResolvedValueOnce({ data: { metricHeaders, dimensionHeaders: [{ name: 'pagePath' }],
        rows: [{ dimensionValues: [{ value: '/share/private-token' }], metricValues: [{ value: '1' }] }] } })
      .mockRejectedValueOnce(new Error('provider error with private response'))
    const report = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', undefined, { routePrivacy: true })
    const requests = gaReport.mock.calls.slice(1).map(([call]) => call.requestBody)
    expect(requests).toHaveLength(5)
    expect(requests.every(request => request.dimensions === undefined)).toBe(true)
    expect(requests[0].dimensionFilter.andGroup.expressions[2]).toMatchObject({ orGroup: { expressions: [
      { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'EXACT', value: '/' } } },
    ] } })
    expect(requests[2].dimensionFilter.andGroup.expressions[2]).toMatchObject({ orGroup: { expressions: [
      { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/report/' } } },
      { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/compare/' } } },
    ] } })
    expect(report.routePrivacy).toMatchObject({ hostname: 'fixflags.com', ga4WebStreamId: '15085844419', checks: [
      { scope: 'homepage-control', evidence: 'observed-aggregate', positiveAggregate: true },
      { scope: 'sites', evidence: 'no-metric-row', positiveAggregate: null },
      { scope: 'reports', evidence: 'observed-aggregate', positiveAggregate: false },
      { scope: 'legacy-shares', evidence: 'invalid-aggregate', positiveAggregate: null },
      { scope: 'credential-documents', evidence: 'unavailable', positiveAggregate: null },
    ] })
    expect(JSON.stringify(report.routePrivacy)).not.toMatch(/3127|private-token|private response/)
  })

  it('withholds grouped, incomplete and invalid totals while retaining an explicit count from a limited report', async () => {
    gaReport.mockResolvedValueOnce({ data: {
      rowCount: 2, metricHeaders: [{ name: 'screenPageViews' }], rows: [{ metricValues: [{ value: '15' }] }],
    } }).mockResolvedValueOnce({ data: {
      metadata: { timeZone: 'UTC', dataTruncationReasons: [{ dataTruncationType: 'DATA_RETENTION' }] },
      metricHeaders: [{ name: 'eventCount' }], rows: [{ metricValues: [{ value: '0' }] }],
    } })
    const report = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'guides-index')
    expect(report).toMatchObject({ ga4: { providerLimited: true, metrics: {} }, analyzeClicks: { providerLimited: true, count: 0 } })

    gaReport.mockResolvedValueOnce({ data: {
      dimensionHeaders: [{ name: 'customEvent:journey_id' }], metricHeaders: [{ name: 'screenPageViews' }],
      rows: [{ dimensionValues: [{ value: 'private-journey-id' }], metricValues: [{ value: '10' }] }],
    } }).mockResolvedValueOnce({ data: {
      metricHeaders: [{ name: 'eventCount' }], rows: [{ metricValues: [{ value: '1.5' }] }],
    } })
    const invalid = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'guides-index')
    expect(invalid).toMatchObject({ ga4: { metrics: {} }, analyzeClicks: { count: null } })
    expect(JSON.stringify(invalid)).not.toContain('private-journey-id')
  })

  it('keeps blank metrics, failed click reads and unverified page aggregation unavailable', async () => {
    gaReport.mockResolvedValueOnce({ data: {
      metricHeaders: [{ name: 'screenPageViews' }], rows: [{ metricValues: [{ value: ' ' }] }],
    } }).mockRejectedValueOnce(new Error('private response for click report'))
    searchReport.mockResolvedValueOnce({ data: { responseAggregationType: 'byProperty', rows: finalizedDates } })
      .mockResolvedValueOnce({ data: { responseAggregationType: 'byProperty', rows: [{ clicks: 20, impressions: 500 }] } })
    const result = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'guides-index')
    expect(result).toMatchObject({
      guide: { path: '/guides' }, ga4: { metrics: {} },
      analyzeClicks: { status: 'report-read-failed', count: null },
      searchConsole: { pageAggregationConfirmed: false, metrics: null },
    })
    expect(JSON.stringify(result)).not.toContain('private response')
  })

  it('keeps a reported guide total while flagging an omitted property date', async () => {
    searchReport.mockResolvedValueOnce({ data: { responseAggregationType: 'byProperty', rows: finalizedDates.filter((_, i) => i !== 3) } })
      .mockResolvedValueOnce({ data: { responseAggregationType: 'byPage', rows: [{ clicks: 1, impressions: 8 }] } })
    const result = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'website-online-but-not-working')
    expect(result.searchConsole).toMatchObject({
      metrics: { clicks: 1, impressions: 8 },
      finalizedWindow: { status: 'partial', observedDays: 27, firstMissingDate: '2026-10-12' },
    })
    expect(JSON.stringify(result.searchConsole)).not.toContain('keys')
  })

  it('refuses malformed coverage and impossible or grouped guide totals', async () => {
    searchReport.mockResolvedValueOnce({ data: { responseAggregationType: 'byProperty',
      rows: [...finalizedDates.slice(0, -1), finalizedDates[0]] } })
      .mockResolvedValueOnce({ data: { responseAggregationType: 'byPage', rows: [{ clicks: 2, impressions: 1 }] } })
    const invalid = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'guides-index')
    expect(invalid.searchConsole).toMatchObject({ metrics: null, finalizedWindow: { status: 'unavailable', observedDays: null } })
    searchReport.mockRejectedValueOnce(new Error('private coverage payload'))
      .mockResolvedValueOnce({ data: { responseAggregationType: 'byPage', rows: [{ keys: ['private row'], clicks: 0, impressions: 1 }] } })
    const grouped = await inspectFixFlagsReporting('2026-10-09', '2026-11-05', 'guides-index')
    expect(grouped.searchConsole).toMatchObject({ metrics: null, finalizedWindow: { status: 'unavailable', observedDays: null } })
    expect(JSON.stringify(grouped)).not.toContain('private')
  })

  it('rejects unrelated properties and malformed windows before credential use', async () => {
    await expect(inspectFixFlagsReporting('2026-02-30', '2026-10-12')).rejects.toThrow('Invalid reporting date')
    await expect(inspectFixFlagsReporting('2026-10-12', '2026-09-15')).rejects.toThrow('Invalid reporting window')
    await expect(inspectFixFlagsReporting('2026-09-15', '2026-10-12', 'https://private.example/')).rejects.toThrow('Unknown FixFlags guide')
    vi.stubEnv('GA4_PROPERTY_ID', 'unrelated-property')
    await expect(inspectFixFlagsReporting('2026-09-15', '2026-10-12')).rejects.toThrow('FixFlags reporting properties are not configured')
    expect(auth).not.toHaveBeenCalled()
    expect(gaReport).not.toHaveBeenCalled()
  })
})
