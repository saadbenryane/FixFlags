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

function hasObservation(value: unknown): boolean {
  return value !== null && typeof value === 'object'
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
    const desktop = hasObservation(data.desktop)
    const mobile = hasObservation(data.mobile)
    const missing: PageSpeedStrategy[] = []
    if (!desktop) missing.push('desktop')
    if (!mobile) missing.push('mobile')
    if (desktop || mobile) observedRoutes += 1
    if (desktop) observedStrategies += 1
    if (mobile) observedStrategies += 1
    if (missing.length > 0) missingRoutes.push({ url: route.url, missing })
  }

  const expectedStrategies = normalizedRoutes.length * 2
  return {
    status:
      observedStrategies === expectedStrategies
        ? 'complete'
        : observedStrategies > 0
          ? 'partial'
          : 'unavailable',
    observedRoutes,
    totalRoutes: normalizedRoutes.length,
    missingRoutes,
  }
}
