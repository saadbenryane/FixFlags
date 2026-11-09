import { auditCache } from './cache'
import { readBoundedJson } from '@/lib/http/read-json'
import { z } from 'zod'
import { pageSpeedReachedSignIn, pageSpeedScopeMatches, performanceMeasurement } from './performance-measurement'
import { readResourceAudits, projectResourceOpportunities, type ResourceAudit } from './pagespeed-opportunities'
import { readTapTargetAudits, type TapTargetAudit } from './pagespeed-tap-targets'
import { collectCruxEvidence, readCruxMetric, type CruxEvidence } from './crux'
import { lighthouseMetric, lighthouseRecord, lighthouseScore } from './lighthouse-audit'
export type { CruxMetrics } from './crux'

export const pageSpeedFailureSchema = z.object({
  code: z.enum(['PROVIDER_QUOTA', 'PROVIDER_UNAVAILABLE', 'PROVIDER_REFUSED', 'PROVIDER_RESPONSE_INVALID', 'MEASUREMENT_INCOMPLETE', 'MEASUREMENT_AUTHENTICATION_REDIRECT']),
  retryable: z.boolean(), retryAfterMs: z.number().finite().nonnegative().optional(),
}).strict()
type PageSpeedFailure = z.infer<typeof pageSpeedFailureSchema>
class PageSpeedError extends Error {
  constructor(message: string, readonly failure: PageSpeedFailure, readonly observation?: PageSpeedResult) { super(message); this.name = 'PageSpeedError' }
}
const providerPayloadSchema = z.object({ lighthouseResult: z.unknown().optional() }).passthrough()
const lighthousePayloadSchema = z.object({
  categories: z.record(z.string(), z.unknown()),
  audits: z.record(z.string(), z.unknown()),
  runtimeError: z.object({ code: z.string(), message: z.string().optional() }).optional(),
}).passthrough()

export interface LighthouseAuditSummary {
  id: string
  title: string
  score: number | null
}

export interface PageSpeedResult {
  strategy: 'desktop' | 'mobile'
  score: number | null
  lcp: number | null
  cls: number | null
  fcp: number | null
  tbt: number | null
  inp: number | null // CrUX p75 over the reported field-data window, not a lab measurement
  // Savings use milliseconds for render blocking and bytes for resource opportunities.
  opportunities: Array<{ id: string; title: string; savings: number; itemsCount?: number }>
  resourceAudits?: ResourceAudit[]
  tapTargetAudits?: TapTargetAudit[]
  failedAccessibilityAudits: LighthouseAuditSummary[]
  diagnostics: Record<string, unknown>
  raw: Record<string, unknown>
  crux: CruxEvidence | null
}

// PSI allows 120 seconds for measurement. Retain transport and parsing time
// inside a separate task budget, while earlier caller deadlines still win.
export const PAGESPEED_REQUEST_TIMEOUT_MS = 130_000
export const PAGESPEED_TASK_TIMEOUT_MS = PAGESPEED_REQUEST_TIMEOUT_MS + 15_000
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000
type PageSpeedObservation = { result: PageSpeedResult | null; error?: string; failure?: PageSpeedFailure }
type PageSpeedData = {
  desktop: PageSpeedResult | null; mobile: PageSpeedResult | null;
  desktopError?: string; mobileError?: string;
  desktopFailure?: PageSpeedFailure; mobileFailure?: PageSpeedFailure;
}

const RETRYABLE_STATUS_PATTERNS = ['429', '500', '502', '503', '504'] as const

const ACCESSIBILITY_AUDIT_IDS = [
  'color-contrast',
  'bypass',
  'focus-traps',
  'focus-visible',
] as const

export function toStoredPageSpeedResult(result: PageSpeedResult): Omit<PageSpeedResult, 'raw'> {
  const { raw, ...stored } = result
  void raw
  return stored
}

function isRetryableError(err: unknown): boolean {
  if (err instanceof PageSpeedError) return err.failure.retryable
  if (err instanceof Error && err.name === 'AbortError') return true
  const message = err instanceof Error ? err.message : String(err)
  return RETRYABLE_STATUS_PATTERNS.some((code) => message.includes(code))
}

async function runPageSpeedWithRetry(
  url: string,
  strategy: 'desktop' | 'mobile',
  signal?: AbortSignal
): Promise<PageSpeedResult> {
  const maxAttempts = 2
  let lastError: unknown
  let observation: PageSpeedResult | undefined
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('Audit deadline approaching')

    try {
      return await runPageSpeed(url, strategy, signal)
    } catch (err) {
      lastError = err
      if (err instanceof PageSpeedError && err.observation) observation = err.observation
      if (!isRetryableError(err) || attempt === maxAttempts) break
      const delayMs = Math.min(2000 * 2 ** (attempt - 1), 15_000)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
  if (observation) throw new PageSpeedError(formatPageSpeedError(lastError), failureFor(lastError), observation)
  throw lastError
}

async function runPageSpeed(
  url: string,
  strategy: 'desktop' | 'mobile',
  externalSignal?: AbortSignal
): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  apiUrl.searchParams.set('url', url)
  apiUrl.searchParams.set('strategy', strategy)
  apiUrl.searchParams.set('category', 'performance')
  apiUrl.searchParams.append('category', 'accessibility')
  if (apiKey) apiUrl.searchParams.set('key', apiKey)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PAGESPEED_REQUEST_TIMEOUT_MS)
  const onAbort = () => controller.abort()

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onAbort, { once: true })
    }
  }

  try {
    const requestedAt = new Date()
    const res = await fetch(apiUrl.toString(), { signal: controller.signal })
    if (!res.ok) {
      const retry = res.headers.get('retry-after'), numeric = retry ? Number(retry) : NaN
      const retryAfterMs = retry ? Number.isFinite(numeric) ? Math.max(0, numeric * 1000) : Math.max(0, Date.parse(retry) - Date.now()) : undefined
      await res.body?.cancel()
      throw new PageSpeedError(`PageSpeed API error: ${res.status}`, {
        code: res.status === 429 ? 'PROVIDER_QUOTA' : res.status >= 500 ? 'PROVIDER_UNAVAILABLE' : 'PROVIDER_REFUSED',
        retryable: res.status === 429 || res.status >= 500,
        ...(retryAfterMs !== undefined && Number.isFinite(retryAfterMs) ? { retryAfterMs } : {}),
      })
    }
    const parsed = providerPayloadSchema.safeParse(await readBoundedJson(res, 8_000_000))
    if (!parsed.success) throw new PageSpeedError('PageSpeed returned an invalid measurement payload', { code: 'PROVIDER_RESPONSE_INVALID', retryable: false })
    const data = parsed.data
    const lighthouse = lighthouseRecord(data.lighthouseResult) ?? {}
    const lab = lighthousePayloadSchema.safeParse(lighthouse)
    const foreignScope = !pageSpeedScopeMatches(lighthouse, url, strategy)
    const authenticationRedirect = !foreignScope && pageSpeedReachedSignIn(lighthouse, url)
    const measurement = performanceMeasurement(lighthouse, strategy, requestedAt)
    // Field records validate their own page/origin. A refused lab scope cannot
    // authorize field evidence for its reported redirect destination.
    const crux = collectCruxEvidence(foreignScope || authenticationRedirect ? { ...data, lighthouseResult: undefined } : data, url)
    const runtimeError = z.object({ code: z.string() }).safeParse(lighthouse.runtimeError)
    const failedRuntime = runtimeError.success && runtimeError.data.code !== 'NO_ERROR'
    if (foreignScope || authenticationRedirect || failedRuntime || !lab.success) {
      const failure: PageSpeedFailure = authenticationRedirect ? { code: 'MEASUREMENT_AUTHENTICATION_REDIRECT', retryable: false }
        : failedRuntime && !foreignScope ? {
        code: 'MEASUREMENT_INCOMPLETE', retryable: ['PROTOCOL_TIMEOUT', 'READ_FAILED', 'PARSING_PROBLEM', 'UNKNOWN_ERROR'].includes(runtimeError.data.code),
      } : { code: 'PROVIDER_RESPONSE_INVALID', retryable: false }
      throw new PageSpeedError(foreignScope ? 'PageSpeed returned a different requested scope'
        : authenticationRedirect ? 'PageSpeed reached an authentication route. Performance of the requested page is unknown.'
        : failedRuntime ? 'PageSpeed did not complete its measurement' : 'PageSpeed returned an invalid measurement payload', failure,
      crux ? { strategy, score: null, lcp: null, cls: null, fcp: null, tbt: null,
        inp: readCruxMetric(crux, 'inp')?.value ?? null, opportunities: [], resourceAudits: [], tapTargetAudits: [],
        failedAccessibilityAudits: [], diagnostics: { measurement: authenticationRedirect ? { ...measurement, scope: null } : measurement }, raw: data, crux } : undefined)
    }

    const audits = lab.data.audits
    const categoryScores = lab.data.categories

    const perfScore = lighthouseScore(categoryScores.performance, 'performance')
    const lcp = lighthouseMetric(audits['largest-contentful-paint'], 'largest-contentful-paint', 'millisecond')
    const cls = lighthouseMetric(audits['cumulative-layout-shift'], 'cumulative-layout-shift', 'unitless')
    const fcp = lighthouseMetric(audits['first-contentful-paint'], 'first-contentful-paint', 'millisecond')
    const tbt = lighthouseMetric(audits['total-blocking-time'], 'total-blocking-time', 'millisecond')

    const failedAccessibilityAudits: LighthouseAuditSummary[] = []
    for (const id of ACCESSIBILITY_AUDIT_IDS) {
      const audit = lighthouseRecord(audits[id]), score = lighthouseScore(audit, id)
      if (audit && score !== null && score < 1) {
        failedAccessibilityAudits.push({
          id,
          title: (typeof audit.title === 'string' ? audit.title : id).slice(0, 1000),
          score,
        })
      }
    }

    const resourceAudits = readResourceAudits(audits)
    const opportunities: PageSpeedResult['opportunities'] = projectResourceOpportunities(resourceAudits)

    const tapTargetAudits = strategy === 'mobile' ? readTapTargetAudits(audits) : []
    opportunities.push(...tapTargetAudits.flatMap(audit => audit.score !== null && audit.score < 1
      ? [{ id: audit.id, title: audit.title, savings: 0, ...(audit.itemsCount ? { itemsCount: audit.itemsCount } : {}) }] : []))

    return {
      strategy,
      score: perfScore !== null ? Math.round(perfScore * 100) : null,
      lcp: lcp !== null ? Math.round(lcp) : null,
      cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,
      fcp: fcp !== null ? Math.round(fcp) : null,
      tbt: tbt !== null ? Math.round(tbt) : null,
      inp: readCruxMetric(crux, 'inp')?.value ?? null,
      opportunities,
      resourceAudits,
      tapTargetAudits,
      failedAccessibilityAudits,
      diagnostics: { measurement },
      raw: data,
      crux,
    }
  } finally {
    clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', onAbort)
  }
}

function formatPageSpeedError(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  return String(reason)
}

function failureFor(reason: unknown): PageSpeedFailure {
  return reason instanceof PageSpeedError ? reason.failure : { code: 'PROVIDER_UNAVAILABLE', retryable: true }
}

export async function fetchPageSpeedData(url: string, signal?: AbortSignal, options: {
  fresh?: boolean; strategies?: readonly ('desktop' | 'mobile')[]; singleAttempt?: boolean;
} = {}): Promise<PageSpeedData> {
  const strategies = options.strategies ?? ['desktop', 'mobile']
  const output: PageSpeedData = { desktop: null, mobile: null }

  await Promise.all([...new Set(strategies)].map(async strategy => {
    const key = auditCache.cacheKeyForPageSpeed(url, strategy, strategy)
    let observation = options.fresh ? null : auditCache.get<PageSpeedObservation>(key)
    if (!observation) {
      try {
        const result = await (options.singleAttempt ? runPageSpeed(url, strategy, signal) : runPageSpeedWithRetry(url, strategy, signal))
        observation = { result }
      } catch (error) {
        observation = { result: error instanceof PageSpeedError ? error.observation ?? null : null,
          error: formatPageSpeedError(error), failure: failureFor(error) }
      }
      if (!signal?.aborted) auditCache.set(key, observation, observation.failure ? FAILURE_CACHE_TTL_MS : 60 * 60 * 1000)
    }
    output[strategy] = observation.result
    if (observation.error) output[`${strategy}Error`] = observation.error
    if (observation.failure) output[`${strategy}Failure`] = observation.failure
  }))

  return output
}
