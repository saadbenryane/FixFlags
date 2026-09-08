import { google } from 'googleapis'
import { googleServiceAccount } from '@/lib/growth/google-auth'
import { persistGrowthArtifact } from '@/lib/growth/artifacts'
import {
  type GrowthPullOptions,
  growthArtifactSegment,
  resolveGrowthPullDays,
} from '@/lib/growth/pull-options'

export type { GrowthPullOptions } from '@/lib/growth/pull-options'

const GSC_COUNTRY_CODES: Record<string, string> = {
  morocco: 'mar',
}

function toGscCountryCode(country: string): string {
  const normalized = country.trim().toLowerCase()
  if (GSC_COUNTRY_CODES[normalized]) return GSC_COUNTRY_CODES[normalized]
  if (/^[a-z]{3}$/.test(normalized)) return normalized
  throw new Error(`Unknown GSC country for exclusion: ${country}`)
}

function gscCountryExclusionFilter(excludeCountries: string[]) {
  if (excludeCountries.length === 0) return undefined
  return [
    {
      groupType: 'and',
      filters: excludeCountries.map((country) => ({
        dimension: 'country',
        operator: 'notEquals',
        expression: toGscCountryCode(country),
      })),
    },
  ]
}

function getGscProperty(): string {
  const prop = process.env.GSC_PROPERTY
  if (!prop) throw new Error('GSC_PROPERTY env var is required')
  return prop
}

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
  options: GrowthPullOptions,
  rowLimit = 25_000,
): Promise<GscRow[]> {
  const dimensionFilterGroups = gscCountryExclusionFilter(options.excludeCountries ?? [])
  const allRows: GscRow[] = []
  let startRow = 0
  for (;;) {
    const requestBody: Record<string, unknown> = { startDate, endDate, dimensions: [dimension], rowLimit, startRow }
    if (dimensionFilterGroups) requestBody.dimensionFilterGroups = dimensionFilterGroups
    const response = await searchconsole.searchanalytics.query({
      siteUrl: getGscProperty(),
      requestBody,
    })
    const rows = (response.data.rows ?? []) as GscRow[]
    allRows.push(...rows)
    if (rows.length < rowLimit) return allRows
    startRow += rows.length
  }
}

export async function runGscPull(options: GrowthPullOptions = {}): Promise<GscPullResult | null> {
  const auth = await googleServiceAccount(['https://www.googleapis.com/auth/webmasters.readonly'])
  if (!auth) return null
  // googleapis-common bundles its own google-auth-library type instance.
  const searchconsole = google.searchconsole({ version: 'v1', auth: auth as unknown as Parameters<typeof google.searchconsole>[0]['auth'] })
  const now = new Date()
  const fetchedAt = now.toISOString()
  const endDate = fetchedAt.slice(0, 10)
  const startDate = new Date(now.getTime() - resolveGrowthPullDays(options) * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)

  const queryRows = await queryGsc(searchconsole, startDate, endDate, 'query', options)
  const pageRows = await queryGsc(searchconsole, startDate, endDate, 'page', options)
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
  const segment = growthArtifactSegment(options)
  await Promise.all([
    persistGrowthArtifact('gsc-queries', `gsc/${segment}/queries`, result.queries),
    persistGrowthArtifact('gsc-pages', `gsc/${segment}/pages`, result.pages),
    persistGrowthArtifact('gsc-summary', `gsc/${segment}/summary`, result.summary),
  ])
  return result
}
