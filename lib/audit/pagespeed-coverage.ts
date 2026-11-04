import { cruxEvidenceSchema, readCruxMetric } from './crux'

export type PageSpeedStrategy = 'desktop' | 'mobile'

export interface PageSpeedMissingRoute {
  url: string
  missing: PageSpeedStrategy[]
}

export interface PageSpeedCoverage {
  status: 'complete' | 'partial' | 'unavailable'
  observedRoutes: number
  totalRoutes: number
  missingRoutes: PageSpeedMissingRoute[]
}

function observation(value: unknown, strategy: PageSpeedStrategy) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return { observed: false, complete: false }
  const data = value as Record<string, unknown>
  if (data.strategy !== undefined && data.strategy !== strategy) return { observed: false, complete: false }
  const metric = (key: string) => typeof data[key] === 'number' && Number.isFinite(data[key]) && data[key] >= 0 &&
    (key !== 'score' || data[key] <= 100)
  const lab = ['score', 'lcp', 'cls', 'fcp', 'tbt']
  const crux = cruxEvidenceSchema.safeParse(data.crux)
  const field = crux.success && (['lcp', 'cls', 'fcp', 'inp', 'ttfb'] as const).some(key => readCruxMetric(crux.data, key))
  return { observed: lab.some(metric) || metric('inp') || field, complete: lab.every(metric) }
}

export function derivePageSpeedCoverage(
  routes: Array<{ url: string; performanceData: unknown }>
): PageSpeedCoverage {
  const normalizedRoutes = routes.length > 0
    ? routes
    : [{ url: '', performanceData: null }]
  let observedRoutes = 0
  let observedStrategies = 0
  const missingRoutes: PageSpeedMissingRoute[] = []

  for (const route of normalizedRoutes) {
    const data =
      route.performanceData && typeof route.performanceData === 'object'
        ? route.performanceData as Record<string, unknown>
        : {}
    const desktop = observation(data.desktop, 'desktop')
    const mobile = observation(data.mobile, 'mobile')
    const missing: PageSpeedStrategy[] = []
    if (!desktop.complete) missing.push('desktop')
    if (!mobile.complete) missing.push('mobile')
    if (desktop.observed || mobile.observed) observedRoutes += 1
    if (desktop.complete) observedStrategies += 1
    if (mobile.complete) observedStrategies += 1
    if (missing.length > 0) missingRoutes.push({ url: route.url, missing })
  }

  const expectedStrategies = normalizedRoutes.length * 2
  return {
    status:
      observedStrategies === expectedStrategies
        ? 'complete'
        : observedRoutes > 0
          ? 'partial'
          : 'unavailable',
    observedRoutes,
    totalRoutes: normalizedRoutes.length,
    missingRoutes,
  }
}
