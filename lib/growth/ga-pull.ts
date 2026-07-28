import { google } from 'googleapis'
import { googleServiceAccount } from '@/lib/growth/google-auth'
import { persistGrowthArtifact } from '@/lib/growth/artifacts'

function getGa4Property(): string {
  const prop = process.env.GA4_PROPERTY_ID
  if (!prop) throw new Error('GA4_PROPERTY_ID env var is required')
  return prop
}

export interface GaPullResult {
  summary: Record<string, number | string>
  sources: { fetchedAt: string; sources: Array<Record<string, string | number>> }
  pages: { fetchedAt: string; pages: Array<Record<string, string | number>> }
  events: { fetchedAt: string; events: Array<Record<string, string | number>> }
}

function dateRange(): { startDate: string; endDate: string } {
  const now = new Date()
  return {
    endDate: now.toISOString().slice(0, 10),
    startDate: new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  }
}

async function runReport(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  dimensions: string[],
  metrics: string[],
  limit = 10_000,
  orderBy?: { metric: string; desc: boolean },
): Promise<Array<Record<string, string | number>>> {
  const body: Record<string, unknown> = {
    dateRanges: [dateRange()],
    dimensions: dimensions.map((name) => ({ name })),
    metrics: metrics.map((name) => ({ name })),
    limit,
  }
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

export async function runGaPull(): Promise<GaPullResult | null> {
  const auth = await googleServiceAccount(['https://www.googleapis.com/auth/analytics.readonly'])
  if (!auth) return null
  // googleapis-common bundles its own google-auth-library type instance.
  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: auth as unknown as Parameters<typeof google.analyticsdata>[0]['auth'] })
  const fetchedAt = new Date().toISOString()
  const summaryRows = await runReport(
    analyticsdata,
    [],
    ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate'],
  )
  const first = summaryRows[0] ?? {}
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
      sources: await runReport(analyticsdata, ['sessionSource'], ['sessions'], 50, {
        metric: 'sessions',
        desc: true,
      }),
    },
    pages: {
      fetchedAt,
      pages: await runReport(analyticsdata, ['pagePath'], ['screenPageViews'], 100, {
        metric: 'screenPageViews',
        desc: true,
      }),
    },
    events: {
      fetchedAt,
      events: await runReport(analyticsdata, ['eventName'], ['eventCount'], 50, {
        metric: 'eventCount',
        desc: true,
      }),
    },
  }

  await Promise.all([
    persistGrowthArtifact('ga-summary', 'ga/rolling-28d/summary', result.summary),
    persistGrowthArtifact('ga-sources', 'ga/rolling-28d/sources', result.sources),
    persistGrowthArtifact('ga-pages', 'ga/rolling-28d/pages', result.pages),
    persistGrowthArtifact('ga-events', 'ga/rolling-28d/events', result.events),
  ])
  return result
}
