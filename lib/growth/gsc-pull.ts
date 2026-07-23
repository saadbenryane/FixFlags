import { google } from 'googleapis'
import { googleServiceAccount } from '@/lib/growth/google-auth'
import { persistGrowthArtifact } from '@/lib/growth/artifacts'

const GSC_PROPERTY = 'sc-domain:fixflags.com'

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

export interface GscSummary {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
  brandedClicks: number
  brandedShare: number
  indexedPages: number
  fetchedAt: string
}

export interface GscPullResult {
  queries: { fetchedAt: string; queries: Array<Record<string, string | number | undefined>> }
  pages: { fetchedAt: string; pages: Array<Record<string, string | number | undefined>> }
  summary: GscSummary
}

async function queryGsc(
  searchconsole: ReturnType<typeof google.searchconsole>,
  startDate: string,
  endDate: string,
  dimension: 'query' | 'page',
  rowLimit = 25_000,
): Promise<GscRow[]> {
  const allRows: GscRow[] = []
  let startRow = 0
  for (;;) {
    const response = await searchconsole.searchanalytics.query({
      siteUrl: GSC_PROPERTY,
      requestBody: { startDate, endDate, dimensions: [dimension], rowLimit, startRow },
    })
    const rows = (response.data.rows ?? []) as GscRow[]
    allRows.push(...rows)
    if (rows.length < rowLimit) return allRows
    startRow += rows.length
  }
}

export async function runGscPull(): Promise<GscPullResult | null> {
  const auth = await googleServiceAccount(['https://www.googleapis.com/auth/webmasters.readonly'])
  if (!auth) return null
  // googleapis-common bundles a separate google-auth-library type instance.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const searchconsole = google.searchconsole({ version: 'v1', auth: auth as any })
  const now = new Date()
  const fetchedAt = now.toISOString()
  const endDate = fetchedAt.slice(0, 10)
  const startDate = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  const queryRows = await queryGsc(searchconsole, startDate, endDate, 'query')
  const pageRows = await queryGsc(searchconsole, startDate, endDate, 'page')
  const queries = queryRows.slice(0, 50).map((row) => ({
    query: row.keys[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position,
  }))
  const pages = pageRows.map((row) => ({
    page: row.keys[0], clicks: row.clicks, impressions: row.impressions, ctr: row.ctr, position: row.position,
  }))
  const totalClicks = queryRows.reduce((sum, row) => sum + row.clicks, 0)
  const totalImpressions = queryRows.reduce((sum, row) => sum + row.impressions, 0)
  const brandedClicks = queryRows
    .filter((row) => row.keys[0]?.toLowerCase().includes('fixflags'))
    .reduce((sum, row) => sum + row.clicks, 0)
  const summary: GscSummary = {
    totalClicks,
    totalImpressions,
    avgCtr: totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 10_000) / 10_000 : 0,
    avgPosition: Math.round(
      (queryRows.reduce((sum, row) => sum + row.position * row.impressions, 0) /
        (totalImpressions || 1)) * 100,
    ) / 100,
    brandedClicks,
    brandedShare: totalClicks > 0 ? Math.round((brandedClicks / totalClicks) * 10_000) / 10_000 : 0,
    indexedPages: new Set(pages.map((page) => page.page)).size,
    fetchedAt,
  }
  const result: GscPullResult = {
    queries: { fetchedAt, queries },
    pages: { fetchedAt, pages },
    summary,
  }
  await Promise.all([
    persistGrowthArtifact('gsc-queries', 'gsc/rolling-28d/queries', result.queries),
    persistGrowthArtifact('gsc-pages', 'gsc/rolling-28d/pages', result.pages),
    persistGrowthArtifact('gsc-summary', 'gsc/rolling-28d/summary', result.summary),
  ])
  return result
}
