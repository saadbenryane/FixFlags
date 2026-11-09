import { google, type analyticsdata_v1beta, type searchconsole_v1 } from 'googleapis'
import { GUIDE_ANALYZE_EVENT, GUIDE_INDEX_ENTRY, isGuideEntry } from '@/lib/analytics/guide-entry'
import { googleServiceAccount } from './google-auth'
import { AI_REFERRAL_METHOD, exactGaFilter, FIXFLAGS_HOST, FIXFLAGS_GA_PROPERTY, FIXFLAGS_GA_WEB_STREAM,
  FIXFLAGS_SEARCH_PROPERTY, gaReportCoverage } from './reporting-targets'

const PROPERTY_GA_METRICS = ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate']
const DAY = 86_400_000
const MAX_GUIDE_COVERAGE_DAYS = 366
const AI_REFERRAL_SOURCES = ['chatgpt.com', 'claude.ai', 'copilot.microsoft.com', 'perplexity.ai']
const ROUTE_PRIVACY_SCOPES = [
  { scope: 'homepage-control', paths: ['/'] },
  { scope: 'sites', paths: ['/sites/'] },
  { scope: 'reports', paths: ['/report/', '/compare/'] },
  { scope: 'legacy-shares', paths: ['/share/'] },
  { scope: 'credential-documents', paths: ['/reset-password', '/cli/authorize'] },
] as const

type GaReport = (metrics: string[], filters: analyticsdata_v1beta.Schema$FilterExpression[]) =>
  Promise<{ data: analyticsdata_v1beta.Schema$RunReportResponse }>

function validSearchCounts(row: searchconsole_v1.Schema$ApiDataRow) {
  return typeof row.clicks === 'number' && typeof row.impressions === 'number' &&
    Number.isSafeInteger(row.clicks) && Number.isSafeInteger(row.impressions) && row.clicks >= 0 && row.clicks <= row.impressions
}

/** Search Console omits dates without data. Confirm each date on the
 * unfiltered property, so a guide with sparse traffic can still qualify. */
async function inspectFinalizedSearchWindow(search: searchconsole_v1.Searchconsole, startDate: string, endDate: string) {
  const start = Date.parse(startDate)
  const expectedDays = (Date.parse(endDate) - start) / DAY + 1
  const scope = { method: 'unfiltered-final-web-by-date' as const, timeZone: 'America/Los_Angeles' as const, startDate, endDate, expectedDays }
  const unavailable = { ...scope, status: 'unavailable' as const, observedDays: null, firstMissingDate: null }
  if (expectedDays > MAX_GUIDE_COVERAGE_DAYS) return unavailable
  try {
    const { data } = await search.searchanalytics.query({
      siteUrl: FIXFLAGS_SEARCH_PROPERTY,
      requestBody: { startDate, endDate, dimensions: ['date'], rowLimit: expectedDays,
        aggregationType: 'byProperty', dataState: 'final', type: 'web' },
    })
    if (data.responseAggregationType !== 'byProperty') return unavailable
    const expected = Array.from({ length: expectedDays }, (_, index) => new Date(start + index * DAY).toISOString().slice(0, 10))
    const validDates = new Set(expected)
    const dates = new Set<string>()
    for (const row of data.rows ?? []) {
      const date = row.keys?.[0]
      if (!date || row.keys?.length !== 1 || !validDates.has(date) || dates.has(date) || !validSearchCounts(row)) return unavailable
      dates.add(date)
    }
    const firstMissingDate = expected.find(date => !dates.has(date)) ?? null
    return { ...scope, status: firstMissingDate ? 'partial' as const : 'confirmed' as const,
      observedDays: dates.size, firstMissingDate }
  } catch {
    return unavailable
  }
}

function aggregateGaMetrics(report: analyticsdata_v1beta.Schema$RunReportResponse, requested: string[]) {
  const metrics: Record<string, number> = {}
  const row = report.rows?.[0]
  const headers = report.metricHeaders ?? []
  const values = row?.metricValues
  if (report.rows?.length !== 1 || (report.rowCount != null && report.rowCount !== 1) || report.dimensionHeaders?.length ||
    row?.dimensionValues?.length || !values || values.length !== headers.length) return metrics
  for (const name of requested) {
    const index = headers.findIndex(header => header.name === name)
    if (index === -1 || headers.findLastIndex(header => header.name === name) !== index) continue
    const raw = values[index]?.value?.trim() ?? ''
    const value = Number(raw)
    if (name === 'engagementRate' ? raw !== '' && value >= 0 && value <= 1 : /^\d+$/.test(raw) && Number.isSafeInteger(value)) {
      metrics[name] = value
    }
  }
  return metrics
}

/** Test fixed path families without ever requesting individual page paths. */
async function inspectRoutePrivacy(gaReport: GaReport, webScope: analyticsdata_v1beta.Schema$FilterExpression[]) {
  return Promise.all(ROUTE_PRIVACY_SCOPES.map(async ({ scope, paths }) => {
    try {
      const pathFilters = paths.map(path => path !== '/' && path.endsWith('/')
        ? { filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', caseSensitive: true, value: path } } }
        : exactGaFilter('pagePath', path))
      const { data } = await gaReport(['screenPageViews'], [
        ...webScope,
        { orGroup: { expressions: pathFilters } },
      ])
      const count = aggregateGaMetrics(data, ['screenPageViews']).screenPageViews
      return {
        scope,
        status: 'report-read-succeeded' as const,
        ...gaReportCoverage(data),
        evidence: count !== undefined ? 'observed-aggregate' : data.rows?.length ? 'invalid-aggregate' : 'no-metric-row',
        positiveAggregate: count === undefined ? null : count > 0,
      }
    } catch {
      return { scope, status: 'report-read-failed' as const, evidence: 'unavailable', positiveAggregate: null }
    }
  }))
}

/** Inspect only the known FixFlags properties. No database client or artifact writes. */
export async function inspectFixFlagsReporting(startDate: string, endDate: string, guide?: string,
  options: { aiReferrals?: boolean; routePrivacy?: boolean } = {}) {
  for (const date of [startDate, endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid reporting date')
    }
  }
  if (startDate > endDate) throw new Error('Invalid reporting window')
  if (guide !== undefined && !isGuideEntry(guide)) throw new Error('Unknown FixFlags guide')
  const guidePath = guide === undefined ? null : guide === GUIDE_INDEX_ENTRY ? '/guides' : `/guides/${guide}`
  const guideUrl = guidePath ? `https://${FIXFLAGS_HOST}${guidePath}` : null
  if (process.env.GA4_PROPERTY_ID?.replace(/^properties\//, '') !== FIXFLAGS_GA_PROPERTY ||
      process.env.GSC_PROPERTY !== FIXFLAGS_SEARCH_PROPERTY) {
    throw new Error('FixFlags reporting properties are not configured')
  }
  const auth = await googleServiceAccount([
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
  ])
  if (!auth) throw new Error('Reporting credential is not configured')
  const googleAuth = auth as unknown as Parameters<typeof google.analyticsdata>[0]['auth']
  const analytics = google.analyticsdata({ version: 'v1beta', auth: googleAuth })
  const search = google.searchconsole({ version: 'v1', auth: googleAuth })
  const webScope = [exactGaFilter('hostName', FIXFLAGS_HOST), exactGaFilter('streamId', FIXFLAGS_GA_WEB_STREAM)]
  const guideFilters = guidePath ? [...webScope, exactGaFilter('pagePath', guidePath)] : []
  const gaReport = (metricNames: string[], filters: analyticsdata_v1beta.Schema$FilterExpression[]) =>
    analytics.properties.runReport({
      property: `properties/${FIXFLAGS_GA_PROPERTY}`,
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: metricNames.map(name => ({ name })),
        ...(filters.length ? { dimensionFilter: { andGroup: { expressions: filters } } } : {}),
      },
    })
  const pageMetrics = guidePath ? ['screenPageViews'] : PROPERTY_GA_METRICS
  // Read the guide total after the coverage probe so it cannot predate a
  // newly finalized day confirmed by that probe.
  const finalizedWindow = guideUrl ? inspectFinalizedSearchWindow(search, startDate, endDate) : Promise.resolve(undefined)
  const reports = Promise.allSettled([
    gaReport(pageMetrics, guideFilters),
    finalizedWindow.then(() => search.searchanalytics.query({
      siteUrl: FIXFLAGS_SEARCH_PROPERTY,
      requestBody: {
        startDate, endDate, dimensions: [], rowLimit: 1, dataState: 'final', type: 'web',
        ...(guideUrl ? { aggregationType: 'auto', dimensionFilterGroups: [{
          groupType: 'and', filters: [{ dimension: 'page', operator: 'equals', expression: guideUrl }],
        }] } : {}),
      },
    })),
    guidePath ? gaReport(['eventCount'], [
      ...guideFilters, exactGaFilter('eventName', GUIDE_ANALYZE_EVENT),
    ]) : null,
    guidePath ? gaReport(['sessions'], [...webScope, exactGaFilter('landingPage', guidePath)]) : null,
    options.aiReferrals ? gaReport(['sessions'], [
      ...webScope,
      ...(guidePath ? [exactGaFilter('landingPage', guidePath)] : []),
      exactGaFilter('sessionMedium', 'referral'),
      { filter: { fieldName: 'sessionSource', inListFilter: { values: AI_REFERRAL_SOURCES, caseSensitive: true } } },
    ]) : null,
  ])
  const privacyReports = options.routePrivacy ? inspectRoutePrivacy(gaReport, webScope) : null
  const [ga, gsc, analyze, landing, aiReferrals] = await reports
  const pageAggregation = gsc.status === 'fulfilled' && gsc.value.data.responseAggregationType === 'byPage'
  const searchRows = gsc.status === 'fulfilled' ? gsc.value.data.rows : undefined
  const firstSearchRow = searchRows?.[0]
  const searchRow = guidePath && (!pageAggregation || searchRows?.length !== 1 || !firstSearchRow ||
    firstSearchRow.keys?.length || !validSearchCounts(firstSearchRow)) ? null : firstSearchRow
  const window = await finalizedWindow
  const analyzeReport = analyze.status === 'fulfilled' ? analyze.value?.data : null
  const landingReport = landing.status === 'fulfilled' ? landing.value?.data : null
  const aiReferralReport = aiReferrals.status === 'fulfilled' ? aiReferrals.value?.data : null
  const routePrivacy = await privacyReports
  return {
    fetchedAt: new Date().toISOString(),
    observationWindow: { startDate, endDate },
    databaseWritten: false,
    ...(routePrivacy && { routePrivacy: {
      ga4WebStreamId: FIXFLAGS_GA_WEB_STREAM,
      hostname: FIXFLAGS_HOST,
      checks: routePrivacy,
    } }),
    ...(options.aiReferrals ? {
      aiReferralSessions: {
        method: AI_REFERRAL_METHOD,
        ga4WebStreamId: FIXFLAGS_GA_WEB_STREAM,
        scope: guidePath ? 'guide-landing-page' : 'sitewide',
        ...(aiReferralReport ? {
          status: 'report-read-succeeded',
          ...gaReportCoverage(aiReferralReport),
          count: aggregateGaMetrics(aiReferralReport, ['sessions']).sessions ?? null,
        } : { status: 'report-read-failed', count: null }),
      },
    } : {}),
    ...(guidePath ? {
      guide: { path: guidePath, canonicalUrl: guideUrl, ga4WebStreamId: FIXFLAGS_GA_WEB_STREAM },
      analyzeClicks: analyzeReport ? {
        eventName: GUIDE_ANALYZE_EVENT,
        status: 'report-read-succeeded',
        ...gaReportCoverage(analyzeReport),
        count: aggregateGaMetrics(analyzeReport, ['eventCount']).eventCount ?? null,
      } : { eventName: GUIDE_ANALYZE_EVENT, status: 'report-read-failed', count: null },
      landingSessions: landingReport ? {
        dimension: 'landingPage',
        status: 'report-read-succeeded',
        ...gaReportCoverage(landingReport),
        count: aggregateGaMetrics(landingReport, ['sessions']).sessions ?? null,
      } : { dimension: 'landingPage', status: 'report-read-failed', count: null },
    } : {}),
    ga4: ga.status === 'fulfilled' ? {
      status: 'report-read-succeeded',
      property: FIXFLAGS_GA_PROPERTY,
      ...gaReportCoverage(ga.value.data),
      metrics: aggregateGaMetrics(ga.value.data, pageMetrics),
      limitations: guidePath ? [
        'Exact production web stream, host and page path. Pageviews include repeats and may omit unconsented visits. Analyze counts use the dedicated consented click event.',
        'The separate landing-session report filters the first pageview path in a session. It does not identify the acquisition channel.',
        'These aggregates are separate from guide-attributed starts, exact claims, and repairs. They do not establish a conversion rate.',
      ] : ['Reported GA users and sessions may omit unconsented activity. No Site or revenue attribution established.'],
    } : { status: 'report-read-failed' },
    searchConsole: gsc.status === 'fulfilled' ? {
      status: 'report-read-succeeded',
      property: FIXFLAGS_SEARCH_PROPERTY,
      ...(guidePath ? { pageAggregationConfirmed: pageAggregation, finalizedWindow: window } : {}),
      metrics: searchRow ? { clicks: searchRow.clicks, impressions: searchRow.impressions, ctr: searchRow.ctr, averagePosition: searchRow.position } : null,
      limitations: ['Web search, finalized data only. Recent days may not yet be available. Average position is not a live rank.'],
    } : { status: 'report-read-failed', ...(guidePath ? { finalizedWindow: window } : {}) },
  }
}
