#!/usr/bin/env -S npx tsx -r dotenv/config
/**
 * Pull Google Analytics 4 data for fixflags.com.
 *
 * Queries the GA4 Data API for the last 28 days and saves:
 *   - docs/growth/metrics/ga-summary.json   (total users, sessions, pageviews, engagement)
 *   - docs/growth/metrics/ga-sources.json   (traffic sources)
 *   - docs/growth/metrics/ga-pages.json     (top pages)
 *   - docs/growth/metrics/ga-events.json    (top events)
 *
 * Manual run:
 *   DOTENV_CONFIG_PATH=.env.local npm run growth:pull-ga
 *
 * Also exported as runGaPull() for the in-process scheduler.
 */
import { config as loadEnv } from 'dotenv'
loadEnv({ path: process.env.DOTENV_CONFIG_PATH ?? '.env.local' })

import { google } from 'googleapis'
import { JWT } from 'google-auth-library'
import { writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'

const GA4_PROPERTY = 'properties/541892062'
const METRICS_DIR = join(process.cwd(), 'docs/growth/metrics')

interface GaDateRange {
  startDate: string
  endDate: string
}

function getAuth(): JWT | null {
  const keyPath = process.env.GSC_SERVICE_ACCOUNT_KEY
  if (!keyPath) {
    console.error('[pull-ga] GSC_SERVICE_ACCOUNT_KEY not set — skipping')
    return null
  }
  if (!existsSync(keyPath)) {
    console.error(`[pull-ga] service account key not found at ${keyPath} — skipping`)
    return null
  }
  return new JWT({
    keyFile: keyPath,
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
}

function dateRange(): GaDateRange {
  const now = new Date()
  const end = now.toISOString().slice(0, 10)
  const start = new Date(now.getTime() - 28 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10)
  return { startDate: start, endDate: end }
}

async function runReport(
  analyticsdata: ReturnType<typeof google.analyticsdata>,
  dimensions: string[],
  metrics: string[],
  limit?: number,
  orderBy?: { metric: string; desc: boolean },
) {
  const { startDate, endDate } = dateRange()
  const body: Record<string, unknown> = {
    dateRanges: [{ startDate, endDate }],
    dimensions: dimensions.map((d) => ({ name: d })),
    metrics: metrics.map((m) => ({ name: m })),
    limit: limit ?? 10_000,
  }
  if (orderBy) {
    body.orderBys = [
      {
        metric: { metricName: orderBy.metric },
        desc: orderBy.desc,
      },
    ]
  }
  const res = await analyticsdata.properties.runReport({
    property: GA4_PROPERTY,
    requestBody: body,
  })
  return (res.data.rows ?? []).map((row) => {
    const entry: Record<string, string | number> = {}
    row.dimensionValues?.forEach((dv, i) => {
      entry[dimensions[i] ?? `dim${i}`] = dv.value ?? ''
    })
    row.metricValues?.forEach((mv, i) => {
      const val = mv.value ?? '0'
      entry[metrics[i] ?? `metric${i}`] = /^[\d.e+-]+$/.test(val)
        ? (val.includes('.') ? parseFloat(val) : parseInt(val, 10))
        : val
    })
    return entry
  })
}

async function ensureDir(fp: string): Promise<void> {
  const dir = dirname(fp)
  if (!existsSync(dir)) await mkdir(dir, { recursive: true })
}

async function saveJson(filename: string, data: unknown): Promise<void> {
  const fp = join(METRICS_DIR, filename)
  await ensureDir(fp)
  await writeFile(fp, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[pull-ga] wrote ${fp}`)
}

export async function runGaPull(): Promise<void> {
  const auth = getAuth()
  if (!auth) return

  const analyticsdata = google.analyticsdata({ version: 'v1beta', auth: auth as any })

  const { startDate, endDate } = dateRange()
  console.log(`[pull-ga] fetching ${startDate} → ${endDate}`)

  // 1. Summary: total users, sessions, pageviews, engagement rate
  const summaryRows = await runReport(
    analyticsdata,
    [],
    ['totalUsers', 'sessions', 'screenPageViews', 'engagementRate'],
  )
  const summary = {
    totalUsers: (summaryRows[0] as Record<string, number>)?.totalUsers ?? 0,
    sessions: (summaryRows[0] as Record<string, number>)?.sessions ?? 0,
    screenPageViews: (summaryRows[0] as Record<string, number>)?.screenPageViews ?? 0,
    engagementRate: (summaryRows[0] as Record<string, number>)?.engagementRate ?? 0,
    fetchedAt: new Date().toISOString(),
  }
  await saveJson('ga-summary.json', summary)

  // 2. Traffic sources (sessionSource → sessions)
  const sources = await runReport(
    analyticsdata,
    ['sessionSource'],
    ['sessions'],
    50,
    { metric: 'sessions', desc: true },
  )
  await saveJson('ga-sources.json', { fetchedAt: new Date().toISOString(), sources })

  // 3. Top pages (pagePath → screenPageViews)
  const pages = await runReport(
    analyticsdata,
    ['pagePath'],
    ['screenPageViews'],
    100,
    { metric: 'screenPageViews', desc: true },
  )
  await saveJson('ga-pages.json', { fetchedAt: new Date().toISOString(), pages })

  // 4. Top events (eventName → eventCount)
  const events = await runReport(
    analyticsdata,
    ['eventName'],
    ['eventCount'],
    15,
    { metric: 'eventCount', desc: true },
  )
  await saveJson('ga-events.json', { fetchedAt: new Date().toISOString(), events })

  console.log('[pull-ga] done')
}

// CLI mode
const isDirectRun = process.argv[1]?.endsWith('pull-ga.ts')
if (isDirectRun) {
  runGaPull()
    .then(() => process.exit(0))
    .catch(async (err) => {
      console.error('[pull-ga] fatal:', err)
      process.exit(1)
    })
}
