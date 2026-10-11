import { auditCache } from './cache'
import { readBoundedJson } from '@/lib/http/read-json'
import { z } from 'zod'

export const pageSpeedFailureSchema = z.object({
  code: z.enum(['PROVIDER_QUOTA', 'PROVIDER_UNAVAILABLE', 'PROVIDER_REFUSED', 'PROVIDER_RESPONSE_INVALID', 'MEASUREMENT_INCOMPLETE']),
  retryable: z.boolean(), retryAfterMs: z.number().finite().nonnegative().optional(),
}).strict()
type PageSpeedFailure = z.infer<typeof pageSpeedFailureSchema>
class PageSpeedError extends Error {
  constructor(message: string, readonly failure: PageSpeedFailure) { super(message); this.name = 'PageSpeedError' }
}
const finiteMetric = z.number().finite().nonnegative()
const providerPayloadSchema = z.object({
  lighthouseResult: z.object({
    categories: z.record(z.string(), z.object({ score: z.number().min(0).max(1).nullable().optional() }).passthrough()),
    audits: z.record(z.string(), z.object({ score: z.number().min(0).max(1).nullable().optional(),
      numericValue: finiteMetric.optional(), title: z.string().optional(), details: z.record(z.string(), z.unknown()).optional() }).passthrough()),
    runtimeError: z.object({ code: z.string(), message: z.string().optional() }).optional(),
  }).passthrough(),
}).passthrough()

export interface LighthouseAuditSummary {
  id: string
  title: string
  score: number | null
}

export interface CruxMetrics {
  lcp: number | null  // p75 in ms
  cls: number | null  // p75
  fcp: number | null  // p75 in ms
  inp: number | null  // p75 in ms
  ttfb: number | null // p75 in ms
  formFactor: string | null
  effectiveConnectionType: string | null
  source?: 'pagespeed-loading-experience'
  scope?: 'page' | 'origin'
  url?: string
  reportingWindowDays?: 28
}

export interface PageSpeedResult {
  strategy: 'desktop' | 'mobile'
  score: number | null
  lcp: number | null
  cls: number | null
  fcp: number | null
  tbt: number | null
  inp: number | null
  opportunities: Array<{ id: string; title: string; savings: number; itemsCount?: number }>
  failedAccessibilityAudits: LighthouseAuditSummary[]
  diagnostics: Record<string, unknown>
  raw: Record<string, unknown>
  crux: CruxMetrics | null
}

function extractCruxMetrics(data: Record<string, unknown>): CruxMetrics | null {
  const experienceSchema = z.object({ id: z.string().url(), metrics: z.record(z.string(), z.object({ percentile: finiteMetric.optional() }).passthrough()) }).passthrough()
  const page = experienceSchema.safeParse(data.loadingExperience), origin = experienceSchema.safeParse(data.originLoadingExperience)
  const recorded = page.success && Object.values(page.data.metrics).some(metric => metric.percentile !== undefined) ? page
    : origin.success && Object.values(origin.data.metrics).some(metric => metric.percentile !== undefined) ? origin : null
  if (!recorded?.success) return null
  const metrics = recorded.data.metrics
  const value = (key: string) => metrics[key]?.percentile ?? null
  // PSI exposes CLS percentiles as hundredths, not the CrUX API's decimal format.
  const cls = value('CUMULATIVE_LAYOUT_SHIFT_SCORE')
  return {
    lcp: value('LARGEST_CONTENTFUL_PAINT_MS'),
    cls: cls !== null ? cls / 100 : null,
    fcp: value('FIRST_CONTENTFUL_PAINT_MS'), inp: value('INTERACTION_TO_NEXT_PAINT'), ttfb: value('EXPERIMENTAL_TIME_TO_FIRST_BYTE'),
    formFactor: null, effectiveConnectionType: null,
    source: 'pagespeed-loading-experience', scope: recorded === page ? 'page' : 'origin',
    url: recorded.data.id, reportingWindowDays: 28,
  }
}

const PAGESPEED_TIMEOUT_MS = 25_000
const FAILURE_CACHE_TTL_MS = 5 * 60 * 1000
const FAILED_SENTINEL = '__FAILED__' as const

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
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new Error('Audit deadline approaching')

    try {
      return await runPageSpeed(url, strategy, signal)
    } catch (err) {
      lastError = err
      if (!isRetryableError(err) || attempt === maxAttempts) break
      const delayMs = Math.min(2000 * 2 ** (attempt - 1), 15_000)
      await new Promise((resolve) => setTimeout(resolve, delayMs))
    }
  }
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
  const timeout = setTimeout(() => controller.abort(), PAGESPEED_TIMEOUT_MS)
  const onAbort = () => controller.abort()

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', onAbort, { once: true })
    }
  }

  try {
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
    const runtimeError = data.lighthouseResult.runtimeError
    if (runtimeError && runtimeError.code !== 'NO_ERROR') throw new PageSpeedError('PageSpeed did not complete its measurement', {
      code: 'MEASUREMENT_INCOMPLETE', retryable: ['PROTOCOL_TIMEOUT', 'READ_FAILED', 'PARSING_PROBLEM', 'UNKNOWN_ERROR'].includes(runtimeError.code),
    })

    const categories = data.lighthouseResult as Record<string, unknown>
    const audits = (categories?.audits || {}) as Record<string, Record<string, unknown>>
    const categoryScores = (categories?.categories || {}) as Record<string, Record<string, unknown>>

    const perfScore = categoryScores.performance?.score as number | null | undefined ?? null
    const lcp = audits['largest-contentful-paint']?.numericValue as number | undefined ?? null
    const cls = audits['cumulative-layout-shift']?.numericValue as number | undefined ?? null
    const fcp = audits['first-contentful-paint']?.numericValue as number | undefined ?? null
    const tbt = audits['total-blocking-time']?.numericValue as number | undefined ?? null
    const inp = audits['interaction-to-next-paint']?.numericValue as number | undefined ?? null

    const failedAccessibilityAudits: LighthouseAuditSummary[] = []
    for (const id of ACCESSIBILITY_AUDIT_IDS) {
      const audit = audits[id]
      if (audit && audit.score !== null && (audit.score as number) < 1) {
        failedAccessibilityAudits.push({
          id,
          title: (audit.title as string) ?? id,
          score: audit.score as number,
        })
      }
    }

    const opportunities: Array<{ id: string; title: string; savings: number; itemsCount?: number }> = []
    const opportunityIds = [
      'render-blocking-resources',
      'unused-javascript',
      'unused-css-rules',
      'uses-optimized-images',
      'uses-webp-images',
      'uses-responsive-images',
      'efficient-animated-content',
      'uses-text-compression',
    ]
    for (const id of opportunityIds) {
      const audit = audits[id]
      if (audit && audit.score !== null && (audit.score as number) < 0.9) {
        const savings = (audit.details as Record<string, unknown>)?.overallSavingsMs as number || 0
        opportunities.push({
          id,
          title: audit.title as string,
          savings: Math.round(savings),
        })
      }
    }

    if (strategy === 'mobile') {
      const tapTargetIds = ['target-size', 'tap-targets', 'tap-targets-too-small']
      for (const id of tapTargetIds) {
        const audit = audits[id]
        if (audit && audit.score !== null && (audit.score as number) < 1) {
          if (!opportunities.some((o) => o.id === id)) {
            const tapItems = ((audit.details as Record<string, unknown>)?.items as unknown[]) ?? []
            opportunities.push({
              id,
              title: (audit.title as string) ?? 'Tap targets are too small',
              savings: 0,
              itemsCount: tapItems.length > 0 ? tapItems.length : undefined,
            })
          }
        }
      }
    }

    const crux = extractCruxMetrics(data)

    return {
      strategy,
      score: perfScore !== null ? Math.round(perfScore * 100) : null,
      lcp: lcp !== null ? Math.round(lcp) : null,
      cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,
      fcp: fcp !== null ? Math.round(fcp) : null,
      tbt: tbt !== null ? Math.round(tbt) : null,
      inp: inp !== null ? Math.round(inp) : null,
      opportunities: opportunities.slice(0, 5),
      failedAccessibilityAudits,
      diagnostics: {},
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

export async function fetchPageSpeedData(url: string, signal?: AbortSignal, options: {
  fresh?: boolean; strategies?: readonly ('desktop' | 'mobile')[]; singleAttempt?: boolean;
} = {}): Promise<{
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  desktopError?: string
  mobileError?: string
  desktopFailure?: PageSpeedFailure
  mobileFailure?: PageSpeedFailure
}> {
  const desktopKey = auditCache.cacheKeyForPageSpeed(url, 'desktop', 'desktop')
  const mobileKey = auditCache.cacheKeyForPageSpeed(url, 'mobile', 'mobile')

  const strategies = options.strategies ?? ['desktop', 'mobile']
  const desktopCached = options.fresh ? null : auditCache.get<PageSpeedResult>(desktopKey)
  const mobileCached = options.fresh ? null : auditCache.get<PageSpeedResult>(mobileKey)

  const cachedDesktop = desktopCached
  const cachedMobile = mobileCached

  const promises: Array<{ strategy: 'desktop' | 'mobile'; promise: Promise<PageSpeedResult> }> = []

  if (strategies.includes('desktop') && !cachedDesktop) {
    promises.push({ strategy: 'desktop', promise:
      (options.singleAttempt ? runPageSpeed(url, 'desktop', signal) : runPageSpeedWithRetry(url, 'desktop', signal))
        .then((result) => {
          auditCache.set(desktopKey, result, 60 * 60 * 1000)
          return result
        })
        .catch((err) => {
          auditCache.set(desktopKey, FAILED_SENTINEL, FAILURE_CACHE_TTL_MS)
          throw err
        })
    })
  }

  if (strategies.includes('mobile') && !cachedMobile) {
    promises.push({ strategy: 'mobile', promise:
      (options.singleAttempt ? runPageSpeed(url, 'mobile', signal) : runPageSpeedWithRetry(url, 'mobile', signal))
        .then((result) => {
          auditCache.set(mobileKey, result, 60 * 60 * 1000)
          return result
        })
        .catch((err) => {
          auditCache.set(mobileKey, FAILED_SENTINEL, FAILURE_CACHE_TTL_MS)
          throw err
        })
    })
  }

  const isFailedSentinel = (v: unknown): boolean => v === FAILED_SENTINEL

  const output: {
    desktop: PageSpeedResult | null
    mobile: PageSpeedResult | null
    desktopError?: string
    mobileError?: string
    desktopFailure?: PageSpeedFailure
    mobileFailure?: PageSpeedFailure
  } = {
    desktop: strategies.includes('desktop') && cachedDesktop && !isFailedSentinel(cachedDesktop) ? cachedDesktop : null,
    mobile: strategies.includes('mobile') && cachedMobile && !isFailedSentinel(cachedMobile) ? cachedMobile : null,
    desktopError: cachedDesktop && isFailedSentinel(cachedDesktop) ? 'PageSpeed failed recently, retrying later' : undefined,
    mobileError: cachedMobile && isFailedSentinel(cachedMobile) ? 'PageSpeed failed recently, retrying later' : undefined,
  }

  if (promises.length > 0) {
    const settled = await Promise.allSettled(promises.map(item => item.promise))
    for (const [index, result] of settled.entries()) {
      const strategy = promises[index].strategy
      if (result.status === 'fulfilled') {
        output[strategy] = result.value
      } else {
        const error = formatPageSpeedError(result.reason)
        output[`${strategy}Error`] = error
        output[`${strategy}Failure`] = result.reason instanceof PageSpeedError ? result.reason.failure : {
          code: 'PROVIDER_UNAVAILABLE', retryable: true,
        }
      }
    }
  }

  return output
}
