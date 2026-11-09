import { google, type analyticsdata_v1beta } from 'googleapis'
import { googleServiceAccount } from '@/lib/growth/google-auth'
import { persistGrowthArtifact } from '@/lib/growth/artifacts'
import { ACQUISITION_FOLLOWUP_DAYS } from '@/lib/analytics/acquisition-value-cohort'
import { captureLandingJourneySnapshot, type LandingJourneySnapshot } from '@/lib/analytics/site-first-value-funnel'
import { exactGaFilter, FIXFLAGS_LANDING_SCOPE, gaReportCoverage } from './reporting-targets'
import { FIXFLAGS_PUBLIC_GA_PAGES, publicGaPageRows } from './public-ga-pages'
import {
  type GrowthPullOptions,
  growthArtifactSegment,
  resolveGrowthPullDays,
} from '@/lib/growth/pull-options'
import {
  ANALYTICS_JOURNEY_PARAM,
  isAnalyticsJourneyId,
} from '@/lib/analytics/journey-id'

export type { GrowthPullOptions } from '@/lib/growth/pull-options'

const GA_LANDING_JOURNEY_ROW_LIMIT = 100_000
const DAY = 86_400_000

function getGa4Property(): string {
  const raw = process.env.GA4_PROPERTY_ID?.trim()
  if (!raw) throw new Error('GA4_PROPERTY_ID env var is required')
  return raw.startsWith('properties/') ? raw : `properties/${raw}`
}

export interface GaPullResult {
  summary: Record<string, number | string>
  sources: { fetchedAt: string; sources: Array<Record<string, string | number>> }
  pages: { fetchedAt: string; pagePathScope?: 'fixflags-public-routes'; pages: Array<Record<string, string | number>> }
  events: { fetchedAt: string; events: Array<Record<string, string | number>> }
  landingJourneys: LandingJourneySnapshot | null
}

export interface GaLandingJourneyArtifact {
  fetchedAt: string
  startDate: string
  endDate: string
  reportingTimeZone: string | null
  providerLimited: boolean
  status: 'available' | 'partial' | 'unavailable'
  journeys: Array<{ journeyId: string; eventCount: number }>
  unattributedEventCount: number
  rowLimitReached: boolean
}

export function buildGaLandingJourneyArtifact(
  rows: Array<Record<string, string | number>>,
  metadata: Pick<GaLandingJourneyArtifact, 'fetchedAt' | 'startDate' | 'endDate'> & { reportingTimeZone?: string | null; providerLimited?: boolean },
  rowLimit = GA_LANDING_JOURNEY_ROW_LIMIT,
): GaLandingJourneyArtifact {
  const journeys: GaLandingJourneyArtifact['journeys'] = []
  let unattributedEventCount = 0
  for (const row of rows) {
    const rawJourneyId = row[`customEvent:${ANALYTICS_JOURNEY_PARAM}`]
    const eventCount = Number(row.eventCount ?? 0)
    if (isAnalyticsJourneyId(rawJourneyId)) {
      journeys.push({ journeyId: rawJourneyId, eventCount })
    } else {
      unattributedEventCount += eventCount
    }
  }
  return {
    ...metadata,
    reportingTimeZone: metadata.reportingTimeZone ?? null,
    providerLimited: metadata.providerLimited ?? false,
    status:
      unattributedEventCount > 0 || rows.length >= rowLimit || metadata.providerLimited
        ? 'partial'
        : 'available',
    journeys,
    unattributedEventCount,
    rowLimitReached: rows.length >= rowLimit,
  }
}

function dateRange(days: number, end: Date): { startDate: string; endDate: string } {
  return {
    endDate: end.toISOString().slice(0, 10),
    startDate: new Date(end.getTime() - (days - 1) * DAY).toISOString().slice(0, 10),
  }
}

function gaCountryExclusionFilter(
  excludeCountries: string[],
): Record<string, unknown> | undefined {
  if (excludeCountries.length === 0) return undefined
  const expressions = excludeCountries.map((country) => ({
    filter: {
      fieldName: 'country',
      stringFilter: { matchType: 'EXACT', value: country },
    },
  }))
  if (expressions.length === 1) return { notExpression: expressions[0] }
  return { notExpression: { orGroup: { expressions } } }
}

function combineDimensionFilters(
  filters: Array<Record<string, unknown> | undefined>,
): Record<string, unknown> | undefined {
  const expressions = filters.filter(
    (filter): filter is Record<string, unknown> => Boolean(filter),
  )
  if (expressions.length === 0) return undefined
  if (expressions.length === 1) return expressions[0]
  return { andGroup: { expressions } }
}

type GaReportTarget = {
  client: ReturnType<typeof google.analyticsdata>
  property: string
}

async function runReport(
  target: GaReportTarget,
  dimensions: string[],
  metrics: string[],
  options: GrowthPullOptions,
  requestedDateRange: { startDate: string; endDate: string },
  limit = 10_000,
  orderBy?: { metric: string; desc: boolean },
  additionalDimensionFilter?: Record<string, unknown>,
  onResponse?: (report: analyticsdata_v1beta.Schema$RunReportResponse) => void,
): Promise<Array<Record<string, string | number>>> {
  const excludeCountries = options.excludeCountries ?? []
  const dimensionFilter = combineDimensionFilters([
    gaCountryExclusionFilter(excludeCountries),
    additionalDimensionFilter,
  ])
  const body: Record<string, unknown> = {
    dateRanges: [requestedDateRange],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit,
  }
  if (dimensionFilter) body.dimensionFilter = dimensionFilter
  if (orderBy) body.orderBys = [{ metric: { metricName: orderBy.metric }, desc: orderBy.desc }]

  const response = await target.client.properties.runReport({
    property: target.property,
    requestBody: body,
  })
  onResponse?.(response.data)
  return (response.data.rows ?? []).map((row) => {
    const entry: Record<string, string | number> = {}
    row.dimensionValues?.forEach((value, index) => {
      entry[dimensions[index] ?? `dimension${index}`] = value.value ?? ''
    })
    row.metricValues?.forEach((value, index) => {
      const raw = value.value ?? '0'
      entry[metrics[index] ?? `metric${index}`] = /^[\d.e+-]+$/.test(raw) ? Number(raw) : raw
    })
    return entry
  })
}

async function pullFixFlagsLandingJourneys(target: GaReportTarget, options: GrowthPullOptions,
  landingDateRange: ReturnType<typeof dateRange>, fetchedAt: string, db?: Parameters<typeof captureLandingJourneySnapshot>[2]) {
  const scope = FIXFLAGS_LANDING_SCOPE
  if (target.property !== `properties/${scope.property}`) return null
  let landingJourneys: GaLandingJourneyArtifact
  try {
    let reportingTimeZone: string | null = null
    let providerLimited = false
    const rows = await runReport(
      target,
      [`customEvent:${ANALYTICS_JOURNEY_PARAM}`],
      ['eventCount'],
      options,
      landingDateRange,
      GA_LANDING_JOURNEY_ROW_LIMIT,
      undefined,
      { andGroup: { expressions: [
        exactGaFilter('hostName', scope.hostname),
        exactGaFilter('streamId', scope.streamId),
        exactGaFilter('pagePath', scope.pagePath),
        exactGaFilter('eventName', scope.eventName),
      ] } },
      (report) => {
        ({ reportingTimeZone, providerLimited } = gaReportCoverage(report))
      },
    )
    landingJourneys = buildGaLandingJourneyArtifact(rows, {
      fetchedAt,
      ...landingDateRange,
      reportingTimeZone,
      providerLimited,
    })
  } catch {
    landingJourneys = {
      fetchedAt,
      ...landingDateRange,
      reportingTimeZone: null,
      providerLimited: false,
      status: 'unavailable',
      journeys: [],
      unattributedEventCount: 0,
      rowLimitReached: false,
    }
  }
  return captureLandingJourneySnapshot({ ...landingJourneys, scope }, undefined, db)
}

/** Read the exact landing cohort without persisting a GA artifact. */
export async function inspectFixFlagsLandingJourneys(window: ReturnType<typeof dateRange>,
  db: NonNullable<Parameters<typeof captureLandingJourneySnapshot>[2]>) {
  const property = getGa4Property()
  if (property !== `properties/${FIXFLAGS_LANDING_SCOPE.property}`) throw new Error('FixFlags GA4 property required')
  const auth = await googleServiceAccount(['https://www.googleapis.com/auth/analytics.readonly'])
  if (!auth) throw new Error('GA4 reporting credential unavailable')
  const target = { property, client: google.analyticsdata({ version: 'v1beta',
    auth: auth as unknown as Parameters<typeof google.analyticsdata>[0]['auth'] }) }
  return pullFixFlagsLandingJourneys(target, {}, window, new Date().toISOString(), db)
}

export async function runGaPull(options: GrowthPullOptions = {}): Promise<GaPullResult | null> {
  const auth = await googleServiceAccount(['https://www.googleapis.com/auth/analytics.readonly'])
  if (!auth) return null
  const target = {
    property: getGa4Property(),
    // googleapis-common bundles its own google-auth-library type instance.
    client: google.analyticsdata({ version: 'v1beta', auth: auth as unknown as Parameters<typeof google.analyticsdata>[0]['auth'] }),
  }
  const now = new Date()
  const fetchedAt = now.toISOString()
  const days = resolveGrowthPullDays(options)
  const requestedDateRange = dateRange(days, now)
  // Leave a full reporting day plus a UTC boundary day beyond the seven-day follow-up.
  const landingDateRange = dateRange(days, new Date(now.getTime() - (ACQUISITION_FOLLOWUP_DAYS + 2) * DAY))
  const summaryRows = await runReport(
    target,
    [],
    ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate'],
    options,
    requestedDateRange,
  )
  const first = summaryRows[0] ?? {}
  const landingJourneys = await pullFixFlagsLandingJourneys(target, options, landingDateRange, fetchedAt)
  const scope = FIXFLAGS_LANDING_SCOPE
  const fixFlagsProperty = target.property === `properties/${scope.property}`
  const pageScope = fixFlagsProperty ? { andGroup: { expressions: [
    exactGaFilter('hostName', scope.hostname), exactGaFilter('streamId', scope.streamId),
    { filter: { fieldName: 'pagePath', inListFilter: { values: FIXFLAGS_PUBLIC_GA_PAGES, caseSensitive: true } } },
  ] } } : undefined
  const pageRows = await runReport(target, ['pagePath'], ['screenPageViews'], options, requestedDateRange, 100,
    { metric: 'screenPageViews', desc: true }, pageScope)
  const result: GaPullResult = {
    summary: {
      totalUsers: Number(first.totalUsers ?? 0),
      sessions: Number(first.sessions ?? 0),
      screenPageViews: Number(first.screenPageViews ?? 0),
      engagementRate: Number(first.engagementRate ?? 0),
      fetchedAt,
      ...requestedDateRange,
    },
    sources: {
      fetchedAt,
      sources: await runReport(target, ['sessionSource'], ['sessions'], options, requestedDateRange, 50, {
        metric: 'sessions',
        desc: true,
      }),
    },
    pages: {
      fetchedAt,
      ...(fixFlagsProperty && { pagePathScope: 'fixflags-public-routes' as const }),
      pages: fixFlagsProperty ? publicGaPageRows(pageRows) : pageRows,
    },
    events: {
      fetchedAt,
      events: await runReport(target, ['eventName'], ['eventCount'], options, requestedDateRange, 50, {
        metric: 'eventCount',
        desc: true,
      }),
    },
    landingJourneys,
  }

  const segment = growthArtifactSegment(options)
  await Promise.all([
    persistGrowthArtifact('ga-summary', `ga/${segment}/summary`, result.summary),
    persistGrowthArtifact('ga-sources', `ga/${segment}/sources`, result.sources),
    persistGrowthArtifact('ga-pages', `ga/${segment}/pages`, result.pages),
    persistGrowthArtifact('ga-events', `ga/${segment}/events`, result.events),
    landingJourneys && persistGrowthArtifact(
      'ga-landing-journeys',
      `ga/${segment}/landing-journeys`,
      landingJourneys,
    ),
  ])
  return result
}
