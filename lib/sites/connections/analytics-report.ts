import { z } from 'zod'
import { ANALYTICS_PAGE_LIMIT, analyticsPagePath, type AnalyticsAudience, type AnalyticsPage, type AnalyticsReport } from './report-scope'

const headers = z.array(z.object({ name: z.string() }))
const reportSchema = z.object({
  dimensionHeaders: headers.max(1).default([]),
  metricHeaders: headers.max(3),
  rows: z.array(z.unknown()).max(ANALYTICS_PAGE_LIMIT).default([]),
  rowCount: z.number().int().nonnegative().optional(),
  metadata: z.object({
    subjectToThresholding: z.boolean().optional(),
    dataLossFromOtherRow: z.boolean().optional(),
    samplingMetadatas: z.array(z.unknown()).optional(),
    dataTruncationReasons: z.array(z.unknown()).optional(),
    schemaRestrictionResponse: z.object({ activeMetricRestrictions: z.array(z.unknown()).optional() }).optional(),
    emptyReason: z.string().optional(),
  }).optional(),
})
const rowSchema = z.object({
  dimensionValues: z.array(z.object({ value: z.string() })).max(1).default([]),
  metricValues: z.array(z.object({ value: z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.number().max(2_147_483_647)) })).max(3),
})
const batchSchema = z.object({ reports: z.array(z.unknown()).max(3) })

function readReport(raw: unknown, metricNames: readonly string[], dimension: 'pagePath' | null, limit: number, boundedTop = false) {
  const parsed = reportSchema.safeParse(raw)
  if (!parsed.success) return undefined
  const { metadata, dimensionHeaders, metricHeaders, rows, rowCount } = parsed.data
  // A qualified context needs an intact window. The deliberate top-page limit
  // is distinct from provider truncation or a missing explicitly watched row.
  if (metadata?.subjectToThresholding || metadata?.dataLossFromOtherRow || metadata?.samplingMetadatas?.length ||
    metadata?.dataTruncationReasons?.length || metadata?.schemaRestrictionResponse?.activeMetricRestrictions?.length || metadata?.emptyReason ||
    rows.length > limit || rowCount !== undefined && (rowCount < rows.length || rows.length < Math.min(rowCount, boundedTop ? limit : Infinity)) ||
    (dimension ? dimensionHeaders.length !== 1 || dimensionHeaders[0].name !== dimension : dimensionHeaders.length !== 0) ||
    metricHeaders.length !== metricNames.length || metricNames.some(name => !metricHeaders.some(header => header.name === name))) return undefined
  return {
    rows,
    read(row: unknown) {
      const parsedRow = rowSchema.safeParse(row)
      if (!parsedRow.success || parsedRow.data.dimensionValues.length !== dimensionHeaders.length ||
        parsedRow.data.metricValues.length !== metricHeaders.length) return undefined
      return { path: parsedRow.data.dimensionValues[0]?.value,
        values: Object.fromEntries(metricHeaders.map((header, index) => [header.name, parsedRow.data.metricValues[index].value])) }
    },
  }
}

/** The batch is ordered by the request. A limited report cannot invalidate
 * an independently qualified sibling or replace its last usable context. */
export function parseAnalyticsReports(value: unknown, watched: string[]): AnalyticsReport {
  const batch = batchSchema.safeParse(value)
  if (!batch.success || batch.data.reports.length !== (watched.length ? 3 : 2))
    throw new Error('Analytics report batch is incomplete')
  const { reports } = batch.data
  const audience = readReport(reports[1], ['sessions', 'activeUsers', 'screenPageViews'], null, 1)
  const measuredAudience = audience?.read(audience.rows[0])?.values
  const audienceValues: AnalyticsAudience = measuredAudience ? {
    sessions: measuredAudience.sessions, activeUsers: measuredAudience.activeUsers, pageViews: measuredAudience.screenPageViews,
  } : {}
  const metrics = ['sessions', 'screenPageViews']
  const watchedPaths = new Set(watched)
  const top = readReport(reports[0], metrics, 'pagePath', ANALYTICS_PAGE_LIMIT, true)
  const selected = watched.length ? readReport(reports[2], metrics, 'pagePath', watched.length) : undefined
  const pages = new Map<string, AnalyticsPage>(), conflicts = new Set<string>()
  let pagesLimited = !top || Boolean(watched.length && !selected)
  for (const report of [top, selected]) for (const row of report?.rows ?? []) {
    const measured = report?.read(row), pagePath = analyticsPagePath(measured?.path)
    if (!measured || !pagePath || report === selected && !watchedPaths.has(pagePath)) {
      pagesLimited = true
      continue
    }
    const sessions = measured.values.sessions, pageViews = measured.values.screenPageViews
    const previous = pages.get(pagePath)
    if (previous && (previous.sessions !== sessions || previous.pageViews !== pageViews)) {
      conflicts.add(pagePath)
      pagesLimited = true
    }
    pages.set(pagePath, { pagePath, sessions, pageViews })
  }
  return {
    pages: [...pages.entries()].filter(([path]) => !conflicts.has(path)).map(([, page]) => page),
    audience: audienceValues,
    pagesLimited,
    audienceLimited: !audience || audience.rows.length > 0 && !measuredAudience,
  }
}
