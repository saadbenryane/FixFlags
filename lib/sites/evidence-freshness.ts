import { watchIntervalMinutes, type WatchInterval } from './watch-schedule'

export const OUTCOME_FRESHNESS_MINUTES = {
  daily: 36 * 60,
  weekly: 8 * 24 * 60,
  manual: 8 * 24 * 60,
} as const

export function outcomeFreshnessMinutes(interval: WatchInterval | null, everyMinutes?: number | null): number {
  if (interval === 'hourly' || interval === 'custom') return watchIntervalMinutes(interval, everyMinutes) + 12 * 60
  return interval ? OUTCOME_FRESHNESS_MINUTES[interval] : OUTCOME_FRESHNESS_MINUTES.manual
}

/** Keep availability and configured bindings on their saved cadence. Repeating
 * the full browser/provider graph more often than daily adds avoidable work. */
export function siteCareIntervalMinutes(interval: WatchInterval, everyMinutes?: number | null): number {
  return Math.max(24 * 60, watchIntervalMinutes(interval, everyMinutes))
}

/** Original broad conclusions retain one weekly cycle plus a day of grace. */
export const SITE_COVERAGE_MAX_AGE_MS = OUTCOME_FRESHNESS_MINUTES.weekly * 60_000

/** Current care can shorten broad assurance. It cannot extend the original
 * eight-day window, or demand broad work faster than its daily execution floor. */
export function siteCoverageMaxAgeMs(interval: WatchInterval | null, everyMinutes?: number | null): number {
  if (!interval || interval === 'weekly') return SITE_COVERAGE_MAX_AGE_MS
  return Math.min(SITE_COVERAGE_MAX_AGE_MS, (siteCareIntervalMinutes(interval, everyMinutes) + 12 * 60) * 60_000)
}

export function siteCoverageIsStale(checkedAt: Date | string | null, now: Date, maxAgeMs = SITE_COVERAGE_MAX_AGE_MS): boolean {
  if (!checkedAt) return true
  const checkedAtMs = checkedAt instanceof Date ? checkedAt.getTime() : Date.parse(checkedAt)
  return !Number.isFinite(checkedAtMs) || now.getTime() - checkedAtMs >= maxAgeMs
}
