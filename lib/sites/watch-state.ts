import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { scheduleFromWatch, scheduleLabel } from './monitoring-schedule'
export type WatchBoardState = 'off' | 'watching' | 'paused' | 'delayed' | 'quota'

export function watchBoardState(input: {
  interval: WatchInterval | null
  nextRunAt: Date | string | null
  lastError: string | null
  consecutiveFailures: number
}): WatchBoardState {
  const nextRunAt = input.nextRunAt
  const error = input.lastError ?? ''
  const quota = /allowance|quota|upgrade/i.test(error)

  if (input.interval && !nextRunAt) return 'paused'
  if (quota && input.interval) return 'quota'
  if (input.consecutiveFailures > 0 || (error && input.interval && nextRunAt)) return 'delayed'
  if (input.interval && nextRunAt) return 'watching'
  return 'off'
}

export function watchBoardLabel(state: WatchBoardState, interval: WatchInterval | null, everyMinutes?: number | null): string {
  if (state === 'watching') {
    return scheduleLabel(scheduleFromWatch(interval, everyMinutes))
  }
  if (state === 'paused') return 'Paused'
  if (state === 'delayed') return 'Delayed'
  if (state === 'quota') return 'Plan limit reached'
  return 'Not monitored'
}

/** True only after a successful schedule write (interval + next run). */
export function watchIsCovered(state: WatchBoardState): boolean {
  return state === 'watching'
}
