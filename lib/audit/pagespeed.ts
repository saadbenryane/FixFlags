import { auditCache } from './cache'

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
  const cruxData = data.crux as Record<string, unknown> | undefined
  const record = (cruxData?.data as Record<string, unknown> | undefined)?.record as Record<string, unknown> | undefined
  if (!record) return null

  const metrics = record.metrics as Record<string, Record<string, unknown>> | undefined
  if (!metrics) return null

  const lcp = metrics.largest_contentful_paint?.percentile as number | undefined ?? null
  const cls = metrics.cumulative_layout_shift?.percentile as number | undefined ?? null
  const fcp = metrics.first_contentful_paint?.percentile as number | undefined ?? null
  const inp = metrics.interaction_to_next_paint?.percentile as number | undefined ?? null
  const ttfb = metrics.first_byte?.percentile as number | undefined ?? null

  const recordKey = record.key as Record<string, unknown> | undefined

  return {
    lcp: lcp !== null ? Math.round(lcp) : null,
    cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,
    fcp: fcp !== null ? Math.round(fcp) : null,
    inp: inp !== null ? Math.round(inp) : null,
    ttfb: ttfb !== null ? Math.round(ttfb) : null,
    formFactor: (recordKey?.formFactor as string) ?? null,
    effectiveConnectionType: (recordKey?.effectiveConnectionType as string) ?? null,
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

  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      externalSignal.addEventListener('abort', () => controller.abort(), { once: true })
    }
  }

  try {
    const res = await fetch(apiUrl.toString(), { signal: controller.signal })
    if (!res.ok) throw new Error(`PageSpeed API error: ${res.status}`)
    const data = await res.json() as Record<string, unknown>

    const categories = data.lighthouseResult as Record<string, unknown>
    const audits = (categories?.audits || {}) as Record<string, Record<string, unknown>>
    const categoryScores = (categories?.categories || {}) as Record<string, Record<string, unknown>>

    const perfScore = categoryScores.performance?.score as number | null
    const lcp = (audits['largest-contentful-paint']?.numericValue as number) || null
    const cls = (audits['cumulative-layout-shift']?.numericValue as number) || null
    const fcp = (audits['first-contentful-paint']?.numericValue as number) || null
    const tbt = (audits['total-blocking-time']?.numericValue as number) || null
    const inp = (audits['interaction-to-next-paint']?.numericValue as number) || null

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
      lcp: lcp ? Math.round(lcp) : null,
      cls: cls !== null ? Math.round(cls * 1000) / 1000 : null,
      fcp: fcp ? Math.round(fcp) : null,
      tbt: tbt ? Math.round(tbt) : null,
      inp: inp !== null ? Math.round(inp) : null,
      opportunities: opportunities.slice(0, 5),
      failedAccessibilityAudits,
      diagnostics: {},
      raw: data,
      crux,
    }
  } finally {
    clearTimeout(timeout)
  }
}

function formatPageSpeedError(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  return String(reason)
}

export async function fetchPageSpeedData(url: string, signal?: AbortSignal): Promise<{
  desktop: PageSpeedResult | null
  mobile: PageSpeedResult | null
  desktopError?: string
  mobileError?: string
}> {
  const desktopKey = auditCache.cacheKeyForPageSpeed(url, 'desktop', 'desktop')
  const mobileKey = auditCache.cacheKeyForPageSpeed(url, 'mobile', 'mobile')

  const desktopCached = auditCache.get<PageSpeedResult>(desktopKey)
  const mobileCached = auditCache.get<PageSpeedResult>(mobileKey)

  const cachedDesktop = desktopCached
  const cachedMobile = mobileCached

  const promises: Promise<{ strategy: string; result: PageSpeedResult }>[] = []

  if (!cachedDesktop) {
    promises.push(
      runPageSpeedWithRetry(url, 'desktop', signal)
        .then((result) => {
          auditCache.set(desktopKey, result, 60 * 60 * 1000)
          return { strategy: 'desktop', result }
        })
        .catch((err) => {
          auditCache.set(desktopKey, FAILED_SENTINEL, FAILURE_CACHE_TTL_MS)
          throw err
        })
    )
  }

  if (!cachedMobile) {
    promises.push(
      runPageSpeedWithRetry(url, 'mobile', signal)
        .then((result) => {
          auditCache.set(mobileKey, result, 60 * 60 * 1000)
          return { strategy: 'mobile', result }
        })
        .catch((err) => {
          auditCache.set(mobileKey, FAILED_SENTINEL, FAILURE_CACHE_TTL_MS)
          throw err
        })
    )
  }

  const isFailedSentinel = (v: unknown): boolean => v === FAILED_SENTINEL

  const output: {
    desktop: PageSpeedResult | null
    mobile: PageSpeedResult | null
    desktopError?: string
    mobileError?: string
  } = {
    desktop: cachedDesktop && !isFailedSentinel(cachedDesktop) ? cachedDesktop : null,
    mobile: cachedMobile && !isFailedSentinel(cachedMobile) ? cachedMobile : null,
    desktopError: cachedDesktop && isFailedSentinel(cachedDesktop) ? 'PageSpeed failed recently, retrying later' : undefined,
    mobileError: cachedMobile && isFailedSentinel(cachedMobile) ? 'PageSpeed failed recently, retrying later' : undefined,
  }

  if (promises.length > 0) {
    const settled = await Promise.allSettled(promises)
    for (const result of settled) {
      if (result.status === 'fulfilled') {
        output[result.value.strategy as 'desktop' | 'mobile'] = result.value.result
      } else {
        const error = formatPageSpeedError(result.reason)
        output.desktopError = output.desktop === null ? error : output.desktopError
        output.mobileError = output.mobile === null ? error : output.mobileError
      }
    }
  }

  return output
}
