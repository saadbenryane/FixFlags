import { auditCache } from './cache'

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
  inp: number | null
  opportunities: Array<{ id: string; title: string; savings: number }>
  failedAccessibilityAudits: LighthouseAuditSummary[]
  diagnostics: Record<string, unknown>
  raw: Record<string, unknown>
}

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

async function runPageSpeed(
  url: string,
  strategy: 'desktop' | 'mobile'
): Promise<PageSpeedResult> {
  const apiKey = process.env.PAGESPEED_API_KEY
  const apiUrl = new URL('https://www.googleapis.com/pagespeedonline/v5/runPagespeed')
  apiUrl.searchParams.set('url', url)
  apiUrl.searchParams.set('strategy', strategy)
  apiUrl.searchParams.set('category', 'performance')
  apiUrl.searchParams.append('category', 'accessibility')
  if (apiKey) apiUrl.searchParams.set('key', apiKey)

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)

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

    const opportunities: Array<{ id: string; title: string; savings: number }> = []
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
            opportunities.push({
              id,
              title: (audit.title as string) ?? 'Tap targets are too small',
              savings: 0,
            })
          }
        }
      }
    }

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
    }
  } finally {
    clearTimeout(timeout)
  }
}

function formatPageSpeedError(reason: unknown): string {
  if (reason instanceof Error) return reason.message
  return String(reason)
}

export async function fetchPageSpeedData(url: string): Promise<{
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
      runPageSpeed(url, 'desktop').then((result) => {
        auditCache.set(desktopKey, result, 60 * 60 * 1000)
        return { strategy: 'desktop', result }
      })
    )
  }

  if (!cachedMobile) {
    promises.push(
      runPageSpeed(url, 'mobile').then((result) => {
        auditCache.set(mobileKey, result, 60 * 60 * 1000)
        return { strategy: 'mobile', result }
      })
    )
  }

  const output: {
    desktop: PageSpeedResult | null
    mobile: PageSpeedResult | null
    desktopError?: string
    mobileError?: string
  } = {
    desktop: cachedDesktop ?? null,
    mobile: cachedMobile ?? null,
    desktopError: undefined,
    mobileError: undefined,
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
