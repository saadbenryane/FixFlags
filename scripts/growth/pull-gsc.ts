#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Pull Google Search Console analytics for fixflags.com.
 *
 * Queries the Search Analytics API for the last 28 days and saves:
 *   - docs/growth/metrics/gsc-queries.json   (top 50 queries)
 *   - docs/growth/metrics/gsc-pages.json     (all pages)
 *   - docs/growth/metrics/gsc-summary.json   (rollup stats)
 *
 * Manual run:
 *   DOTENV_CONFIG_PATH=.env.local npm run growth:pull-gsc
 *
 * Also exported as runGscPull() for the in-process scheduler
 * (lib/queue/recovery-scheduler.ts).
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const GSC_PROPERTY = 'sc-domain:fixflags.com'
const METRICS_DIR = join(process.cwd(), 'docs/growth/metrics')

interface GscRow {
  keys: string[]
  clicks: number
  impressions: number
  ctr: number
  position: number
}

interface GscSummary {
  totalClicks: number
  totalImpressions: number
  avgCtr: number
  avgPosition: number
  brandedClicks: number
  brandedShare: number
  indexedPages: number
  fetchedAt: string
}

function getAuth(): JWT | null {
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_KEY
  if (!keyPath) {
    console.error('[pull-gsc] GSC_SERVICE_ACCOUNT_KEY not set — skipping')
    return null
  }
  if (!existsSync(keyPath)) {
    console.error(`[pull-gsc] service account key not found at ${keyPath} — skipping`)
    return null
  }
  return new JWT({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
}

async function queryGsc(
  searchconsole: ReturnType<typeof google.searchconsole>,
  startDate: string,
  endDate: string,
  dimension: 'query' | 'page',
  rowLimit?: number,
): Promise<GscRow[]> {
  const allRows: GscRow[] = []
  let startRow = 0

  for (;;) {
    const res = await searchconsole.searchanalytics.query({
      siteUrl: GSC_PROPERTY,
      requestBody: {
        startDate,
        endDate,
        dimensions: [dimension],
        rowLimit: rowLimit ?? 25_000,
        startRow,
      },
    })

    const rows = (res.data.rows ?? []) as GscRow[]
    allRows.push(...rows)

    if (rows.length < (rowLimit ?? 25_000)) break
    startRow += rows.length
  }

  return allRows
}

async function ensureDir(fp: string): Promise<void> {
  const dir = dirname(fp)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

async function saveJson(filename: string, data: unknown): Promise<void> {
  const fp = join(METRICS_DIR, filename)
  await ensureDir(fp)
  await writeFile(fp, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[pull-gsc] wrote ${fp}`)
}

export async function runGscPull(): Promise<GscSummary | null> {
  const auth = getAuth()
  if (!auth) return null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- googleapis-common bundles its own google-auth-library types
  const searchconsole = google.searchconsole({ version: 'v1', auth: auth as any })

  const now = new Date()
  const endDate = now.toISOString().slice(0, 10)
  const start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().slice(0, 10)

  console.log(`[pull-gsc] fetching ${startDate} → ${endDate}`)

  // 1. Top 50 queries
  const queries = (await queryGsc(searchconsole, startDate, endDate, 'query', 50)).map(
    (r) => ({
      query: r.keys[0],
      clicks: r.clicks,
      impressions: r.impressions,
      ctr: r.ctr,
      position: r.position,
    }),
  )
  await saveJson('gsc-queries.json', { fetchedAt: now.toISOString(), queries })

  // 2. All pages
  const pages = (await queryGsc(searchconsole, startDate, endDate, 'page')).map((r) => ({
    page: r.keys[0],
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    position: r.position,
  }))
  await saveJson('gsc-pages.json', { fetchedAt: now.toISOString(), pages })

  // 3. Summary stats
  const allRows = await queryGsc(searchconsole, startDate, endDate, 'query')

  const totalClicks = allRows.reduce((s, r) => s + r.clicks, 0)
  const totalImpressions = allRows.reduce((s, r) => s + r.impressions, 0)
  const avgCtr = totalImpressions > 0 ? totalClicks / totalImpressions : 0
  const avgPosition =
    allRows.reduce((s, r) => s + r.position * r.impressions, 0) /
    (totalImpressions || 1)

  const brandedClicks = allRows
    .filter((r) => r.keys[0]?.toLowerCase().includes('fixflags'))
    .reduce((s, r) => s + r.clicks, 0)
  const brandedShare = totalClicks > 0 ? brandedClicks / totalClicks : 0

  const indexedPages = new Set(pages.map((p) => p.page)).size

  const summary: GscSummary = {
    totalClicks,
    totalImpressions,
    avgCtr: Math.round(avgCtr * 10000) / 10000,
    avgPosition: Math.round(avgPosition * 100) / 100,
    brandedClicks,
    brandedShare: Math.round(brandedShare * 10000) / 10000,
    indexedPages,
    fetchedAt: now.toISOString(),
  }
  await saveJson('gsc-summary.json', summary)

  console.log(`[pull-gsc] done — ${totalClicks} clicks, ${totalImpressions} impressions, ${indexedPages} pages`)
  return summary
}

// CLI mode when invoked directly
const isDirectRun = process.argv[1]?.endsWith('pull-gsc.ts')
if (isDirectRun) {
  runGscPull()
    .then((summary) => {
      if (summary) console.log('[pull-gsc] summary:', summary)
      process.exit(0)
    })
    .catch(async (err) => {
      console.error('[pull-gsc] fatal:', err)
      process.exit(1)
    })
}
