import { z } from 'zod'

const metricNames = {
  lcp: 'LARGEST_CONTENTFUL_PAINT_MS', cls: 'CUMULATIVE_LAYOUT_SHIFT_SCORE', fcp: 'FIRST_CONTENTFUL_PAINT_MS',
  inp: 'INTERACTION_TO_NEXT_PAINT', ttfb: 'EXPERIMENTAL_TIME_TO_FIRST_BYTE',
} as const
export type CruxMetric = keyof typeof metricNames

/** Historical single-cohort records retain their original, possibly unknown scope. */
const legacyMetricsSchema = z.object({
  lcp: z.number().finite().nullable(), cls: z.number().finite().nullable(), fcp: z.number().finite().nullable(),
  inp: z.number().finite().nullable(), ttfb: z.number().finite().nullable(),
  formFactor: z.string().max(32_000).nullable(), effectiveConnectionType: z.string().max(32_000).nullable(),
  source: z.literal('pagespeed-loading-experience').optional(), scope: z.enum(['page', 'origin']).optional(),
  url: z.string().url().optional(), reportingWindowDays: z.literal(28).optional(),
}).strict()
export type CruxMetrics = z.infer<typeof legacyMetricsSchema>
const cohortSchema = legacyMetricsSchema.extend({
  source: z.literal('pagespeed-loading-experience'), scope: z.enum(['page', 'origin']),
  url: z.string().url(), reportingWindowDays: z.literal(28),
  responseKey: z.enum(['loadingExperience', 'originLoadingExperience']),
})
const evidenceSchema = z.object({ version: z.literal(1), cohorts: z.array(cohortSchema).min(1).max(2) }).strict()
  .refine(value => new Set(value.cohorts.map(cohort => cohort.responseKey)).size === value.cohorts.length,
    'Duplicate CrUX response source')
export const cruxEvidenceSchema = z.union([evidenceSchema, legacyMetricsSchema])
export type CruxEvidence = z.infer<typeof cruxEvidenceSchema>

function fieldPage(value: unknown): URL | null {
  if (typeof value !== 'string' || value.length > 8192) return null
  try {
    const url = new URL(value)
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null
    // CrUX aggregates query and fragment variants of a page. This identity is
    // separate from the exact URLs required by live-page verification.
    url.search = ''; url.hash = ''
    return url
  } catch { return null }
}

/** Each provider record owns its metrics. A malformed or absent metric cannot
 * erase independent measurements, and origin fallback never becomes page proof. */
export function collectCruxEvidence(data: Record<string, unknown>, requestedUrl: string): CruxEvidence | null {
  const requested = fieldPage(requestedUrl)
  if (!requested) return null
  const lighthouse = data.lighthouseResult as { finalDisplayedUrl?: unknown; finalUrl?: unknown } | undefined
  const final = fieldPage(lighthouse?.finalDisplayedUrl ?? lighthouse?.finalUrl)
  const pages = [requested, ...(final ? [final] : [])]
  const experienceSchema = z.object({ id: z.string().url(), metrics: z.record(z.string(), z.unknown()),
    origin_fallback: z.boolean().optional() })
  const percentileSchema = z.object({ percentile: z.number().finite().nonnegative() })
  const cohorts: z.infer<typeof cohortSchema>[] = []
  for (const responseKey of ['loadingExperience', 'originLoadingExperience'] as const) {
    const parsed = experienceSchema.safeParse(data[responseKey])
    if (!parsed.success) continue
    const scope = responseKey === 'originLoadingExperience' || parsed.data.origin_fallback === true ? 'origin' : 'page'
    const observed = fieldPage(parsed.data.id)
    if (!observed || !pages.some(page => scope === 'page' ? observed.href === page.href
      : observed.pathname === '/' && observed.origin === page.origin)) continue
    const value = (metric: CruxMetric) => {
      const observed = percentileSchema.safeParse(parsed.data.metrics[metricNames[metric]])
      return observed.success ? observed.data.percentile / (metric === 'cls' ? 100 : 1) : null
    }
    const metrics = { lcp: value('lcp'), cls: value('cls'), fcp: value('fcp'), inp: value('inp'), ttfb: value('ttfb') }
    if (Object.values(metrics).every(metric => metric === null)) continue
    cohorts.push({ ...metrics, formFactor: null, effectiveConnectionType: null, source: 'pagespeed-loading-experience',
      scope,
      url: parsed.data.id, reportingWindowDays: 28, responseKey })
  }
  return cohorts.length ? evidenceSchema.parse({ version: 1, cohorts }) : null
}

/** Prefer a page measurement for this metric, then its recorded origin context.
 * Selection never copies another metric's source, URL or reporting conditions. */
export function readCruxMetric(evidence: CruxEvidence | null, metric: CruxMetric): { value: number; cohort: CruxMetrics } | null {
  if (!evidence) return null
  const cohorts = 'cohorts' in evidence ? evidence.cohorts : [evidence]
  const priority = (cohort: CruxMetrics) => cohort.scope === 'page' ? 0 : cohort.scope === 'origin' ? 1 : 2
  const cohort = [...cohorts].sort((a, b) => priority(a) - priority(b)).find(item =>
    typeof item[metric] === 'number' && Number.isFinite(item[metric]) && item[metric]! >= 0)
  return cohort ? { value: cohort[metric]!, cohort } : null
}
