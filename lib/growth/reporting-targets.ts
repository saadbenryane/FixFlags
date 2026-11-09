import type { analyticsdata_v1beta } from 'googleapis'

export const FIXFLAGS_HOST = 'fixflags.com'
export const FIXFLAGS_GA_PROPERTY = '541892062'
export const FIXFLAGS_GA_WEB_STREAM = '15085844419'
export const FIXFLAGS_GA_MEASUREMENT_ID = 'G-5GEP9X4ZWG'
export const FIXFLAGS_SEARCH_PROPERTY = 'sc-domain:fixflags.com'
export const AI_REFERRAL_METHOD = 'ga4-session-source-referral-v1'

export const FIXFLAGS_LANDING_SCOPE = {
  property: FIXFLAGS_GA_PROPERTY,
  hostname: FIXFLAGS_HOST,
  streamId: FIXFLAGS_GA_WEB_STREAM,
  pagePath: '/',
  eventName: 'landing_view',
} as const

export function exactGaFilter(fieldName: string, value: string): analyticsdata_v1beta.Schema$FilterExpression {
  return { filter: { fieldName, stringFilter: { matchType: 'EXACT', caseSensitive: true, value } } }
}

export function gaReportCoverage(report: analyticsdata_v1beta.Schema$RunReportResponse) {
  // The installed client predates this field in the v1beta response.
  const metadata = report.metadata as (analyticsdata_v1beta.Schema$ResponseMetaData & { dataTruncationReasons?: unknown[] }) | undefined
  return {
    reportingTimeZone: metadata?.timeZone ?? null,
    providerLimited: Boolean(metadata?.subjectToThresholding || metadata?.dataLossFromOtherRow ||
      metadata?.samplingMetadatas?.length || metadata?.dataTruncationReasons?.length ||
      metadata?.schemaRestrictionResponse?.activeMetricRestrictions?.length ||
      (report.rowCount != null && report.rowCount !== (report.rows?.length ?? 0))),
  }
}
