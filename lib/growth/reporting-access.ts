import { google } from 'googleapis'
import { googleServiceAccount } from './google-auth'

/** Inspect only the known FixFlags properties. No database client or artifact writes. */
export async function inspectFixFlagsReporting(startDate: string, endDate: string) {
  for (const date of [startDate, endDate]) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid reporting date')
    }
  }
  if (startDate > endDate) throw new Error('Invalid reporting window')
  if (process.env.GA4_PROPERTY_ID?.replace(/^properties\//, '') !== '541892062' ||
      process.env.GSC_PROPERTY !== 'sc-domain:fixflags.com') {
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
  const [ga, gsc] = await Promise.allSettled([
    analytics.properties.runReport({
      property: 'properties/541892062',
      requestBody: {
        dateRanges: [{ startDate, endDate }],
        metrics: ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate'].map((name) => ({ name })),
      },
    }),
    search.searchanalytics.query({
      siteUrl: 'sc-domain:fixflags.com',
      requestBody: { startDate, endDate, dimensions: [], rowLimit: 1, dataState: 'final', type: 'web' },
    }),
  ])
  const metrics: Record<string, number> = {}
  if (ga.status === 'fulfilled') {
    for (const [index, header] of (ga.value.data.metricHeaders ?? []).entries()) {
      if (!header.name || !['totalUsers', 'sessions', 'screenPageViews', 'engagementRate'].includes(header.name)) continue
      const value = Number(ga.value.data.rows?.[0]?.metricValues?.[index]?.value)
      if (Number.isFinite(value)) metrics[header.name] = value
    }
  }
  const searchRow = gsc.status === 'fulfilled' ? gsc.value.data.rows?.[0] : null
  return {
    fetchedAt: new Date().toISOString(),
    observationWindow: { startDate, endDate },
    databaseWritten: false,
    ga4: ga.status === 'fulfilled' ? {
      status: 'report-read-succeeded',
      property: '541892062',
      reportingTimeZone: ga.value.data.metadata?.timeZone ?? null,
      providerLimited: Boolean(ga.value.data.metadata?.subjectToThresholding ||
        ga.value.data.metadata?.dataLossFromOtherRow || ga.value.data.metadata?.samplingMetadatas?.length),
      metrics,
      limitations: ['Reported GA users and sessions may omit unconsented activity. No Site or revenue attribution established.'],
    } : { status: 'report-read-failed' },
    searchConsole: gsc.status === 'fulfilled' ? {
      status: 'report-read-succeeded',
      property: 'sc-domain:fixflags.com',
      metrics: searchRow ? { clicks: searchRow.clicks, impressions: searchRow.impressions, ctr: searchRow.ctr, averagePosition: searchRow.position } : null,
      limitations: ['Web search, finalized data only. Recent days may not yet be available. Average position is not a live rank.'],
    } : { status: 'report-read-failed' },
  }
}
