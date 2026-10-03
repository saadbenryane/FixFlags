import { google } from 'googleapis'
import { googleServiceAccount } from '@/lib/growth/google-auth'
import { persistGrowthArtifact } from '@/lib/growth/artifacts'
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

function getGa4Property(): string {
  const raw = process.env.GA4_PROPERTY_ID?.trim()
  if (!raw) throw new Error('GA4_PROPERTY_ID env var is required')
  return raw.startsWith('properties/') ? raw : `properties/${raw}`
}

export interface GaPullResult {
  summary: Record<string, number | string>
  sources: { fetchedAt: string; sources: Array<Record<string, string | number>> }
  pages: { fetchedAt: string; pages: Array<Record<string, string | number>> }
  events: { fetchedAt: string; events: Array<Record<string, string | number>> }
  landingJourneys: GaLandingJourneyArtifact
}

export interface GaLandingJourneyArtifact {
  fetchedAt: string
  startDate: string
  endDate: string
  status: 'available' | 'partial' | 'unavailable'
  journeys: Array<{ journeyId: string; eventCount: number }>
  unattributedEventCount: number
}

export function buildGaLandingJourneyArtifact(
  rows: Array<Record<string, string | number>>,
  metadata: Pick<GaLandingJourneyArtifact, 'fetchedAt' | 'startDate' | 'endDate'>,
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
    status: unattributedEventCount > 0 ? 'partial' : 'available',
    journeys,
    unattributedEventCount,
  }
}

function dateRange(days: number): { startDate: string; endDate: string } {
  const now = new Date()
  return {
    endDate: now.toISOString().slice(0, 10),
    startDate: new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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

async function runReport(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  dimensions: string[],
  metrics: string[],
  options: GrowthPullOptions,
  requestedDateRange: { startDate: string; endDate: string },
  limit = 10_000,
  orderBy?: { metric: string; desc: boolean },
  additionalDimensionFilter?: Record<string, unknown>,
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

  const response = await analyticsdata.properties.runReport({
    property: getGa4Property(),
    requestBody: body,
  })
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

export async function runGaPull(options: GrowthPullOptions = {}): Promise<GaPullResult | null> {
  const auth = await googleServiceAccount(['https://www.googleapis.com/auth/analytics.readonly'])
  if (!auth) return null
  // googleapis-common bundles its own google-auth-library type instance.
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: auth as unknown as Parameters<typeof google.analyticsdata>[0]['auth'] })
  const fetchedAt = new Date().toISOString()
  const requestedDateRange = dateRange(resolveGrowthPullDays(options))
  const summaryRows = await runReport(
    analyticsdata,
    [],
    ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate'],
    options,
    requestedDateRange,
  )
  const first = summaryRows[0] ?? {}
  let landingJourneys: GaLandingJourneyArtifact
  try {
    const rows = await runReport(
      analyticsdata,
      [`customEvent:${ANALYTICS_JOURNEY_PARAM}`],
      ['eventCount'],
      options,
      requestedDateRange,
      10_000,
      undefined,
      {
        filter: {
          fieldName: 'eventName',
          stringFilter: { matchType: 'EXACT', value: 'landing_view' },
        },
      },
    )
    landingJourneys = buildGaLandingJourneyArtifact(rows, {
      fetchedAt,
      ...requestedDateRange,
    })
  } catch {
    landingJourneys = {
      fetchedAt,
      ...requestedDateRange,
      status: 'unavailable',
      journeys: [],
      unattributedEventCount: 0,
    }
  }
  const result: GaPullResult = {
    summary: {
      totalUsers: Number(first.totalUsers ?? 0),
      sessions: Number(first.sessions ?? 0),
      screenPageViews: Number(first.screenPageViews ?? 0),
      engagementRate: Number(first.engagementRate ?? 0),
      fetchedAt,
    },
    sources: {
      fetchedAt,
      sources: await runReport(analyticsdata, ['sessionSource'], ['sessions'], options, requestedDateRange, 50, {
        metric: 'sessions',
        desc: true,
      }),
    },
    pages: {
      fetchedAt,
      pages: await runReport(analyticsdata, ['pagePath'], ['screenPageViews'], options, requestedDateRange, 100, {
        metric: 'screenPageViews',
        desc: true,
      }),
    },
    events: {
      fetchedAt,
      events: await runReport(analyticsdata, ['eventName'], ['eventCount'], options, requestedDateRange, 50, {
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
    persistGrowthArtifact(
      'ga-landing-journeys',
      `ga/${segment}/landing-journeys`,
      result.landingJourneys,
    ),
  ])
  return result
}
