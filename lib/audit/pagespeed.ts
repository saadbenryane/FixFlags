export interface PageSpeedResult {
  strategy: 'desktop' | 'mobile'
  score: number | null
  lcp: number | null
  cls: number | null
  fcp: number | null
  tbt: number | null
  opportunities: Array<{ id: string; title: string; savings: number }>
  diagnostics: Record<string, unknown>
  raw: Record<string, unknown>
}

export function toStoredPageSpeedResult(result: PageSpeedResult): Omit<PageSpeedResult, 'raw'> {
  const { raw: _raw, ...stored } = result
  void _raw
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
      opportunities: opportunities.slice(0, 5),
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
  const [desktop, mobile] = await Promise.allSettled([
    runPageSpeed(url, 'desktop'),
    runPageSpeed(url, 'mobile'),
  ])

  return {
    desktop: desktop.status === 'fulfilled' ? desktop.value : null,
    mobile: mobile.status === 'fulfilled' ? mobile.value : null,
    desktopError:
      desktop.status === 'rejected' ? formatPageSpeedError(desktop.reason) : undefined,
    mobileError:
      mobile.status === 'rejected' ? formatPageSpeedError(mobile.reason) : undefined,
  }
}
