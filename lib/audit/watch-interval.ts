import { ProjectWatchInterval } from '@prisma/client'

export type WatchInterval = 'weekly' | 'daily'

const INTERVAL_MS: Record<WatchInterval, number> = {
  weekly: 7 * 24 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
}

/** Pulse is cheap reachability. Full is Playwright + Flags. Hourly pulse is not scheduled until costed. */
export function plannedWatchJobs(interval: WatchInterval): { pulse: 'daily' | 'hourly' | null; full: WatchInterval } {
  return { pulse: null, full: interval }
}

export function toStoredWatchInterval(interval: WatchInterval): ProjectWatchInterval {
  return interval === 'daily' ? 'DAILY' : 'WEEKLY'
}

export function fromStoredWatchInterval(interval: ProjectWatchInterval | null): WatchInterval | null {
  return interval === 'DAILY' ? 'daily' : interval === 'WEEKLY' ? 'weekly' : null
}

export function calcWatchNextRun(interval: WatchInterval, from = new Date()): Date {
  return new Date(from.getTime() + INTERVAL_MS[interval])
}

export function isWatchInterval(value: unknown): value is WatchInterval {
  return value === 'weekly' || value === 'daily'
}
