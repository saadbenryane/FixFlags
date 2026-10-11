import { ProjectWatchInterval } from '@prisma/client'
import { WATCH_INTERVALS, watchIntervalMinutes, type WatchInterval } from '@/lib/sites/watch-schedule'

export type { WatchInterval } from '@/lib/sites/watch-schedule'

/** Every cadence uses the same quota-gated verification path. */
export function plannedWatchJobs(interval: WatchInterval): { pulse: 'daily' | 'hourly' | null; full: WatchInterval } {
  return { pulse: null, full: interval }
}

export function toStoredWatchInterval(interval: WatchInterval): ProjectWatchInterval {
  return { daily: ProjectWatchInterval.DAILY, weekly: ProjectWatchInterval.WEEKLY, hourly: ProjectWatchInterval.HOURLY, custom: ProjectWatchInterval.CUSTOM }[interval]
}

export function fromStoredWatchInterval(interval: ProjectWatchInterval | null): WatchInterval | null {
  return interval ? { DAILY: 'daily', WEEKLY: 'weekly', HOURLY: 'hourly', CUSTOM: 'custom' }[interval] as WatchInterval : null
}

export function calcWatchNextRun(interval: WatchInterval, from = new Date(), everyMinutes?: number | null): Date {
  return new Date(from.getTime() + watchIntervalMinutes(interval, everyMinutes) * 60_000)
}

export function isWatchInterval(value: unknown): value is WatchInterval {
  return WATCH_INTERVALS.some(interval => interval === value)
}
