import type { WatchInterval } from '@/lib/sites/watch-schedule'
import { scheduleFromWatch, scheduleLabel } from './monitoring-schedule'
import { monitoringIsOverdue } from './monitoring-freshness'
export type WatchBoardState = 'off' | 'watching' | 'paused' | 'delayed' | 'quota'

export const WATCH_MESSAGES = {
  paused: 'Paused. This Site is not on a check schedule.',
  accountUnavailable: 'Watching is not available on this account.',
  scheduleUnavailable: 'This schedule is not available on your plan. Choose an available monitoring schedule.',
  allowanceUsed: 'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
  retryPending: 'The scheduled check did not finish. FixFlags will try again.',
} as const

const allowanceMessages = new Set([WATCH_MESSAGES.allowanceUsed, 'This month’s Site check allowance is used.',
  'Watch paused because this month’s Site check allowance is used.'])
const publicMessages = new Set([...Object.values(WATCH_MESSAGES), ...allowanceMessages, 'Paused.'])

/** Older scheduler rows can contain an internal exception instead of a customer message. */
export function watchErrorMessage(error: string | null): string | null {
  if (!error || publicMessages.has(error)) return error || null
  return WATCH_MESSAGES.retryPending
}

export function watchBoardState(input: {
  interval: WatchInterval | null
  nextRunAt: Date | string | null
  pausedAt: Date | string | null
  lastError: string | null
  consecutiveFailures: number
  now: Date
}): WatchBoardState {
  const nextRunAt = input.nextRunAt
  const error = input.lastError ?? ''
  const quota = allowanceMessages.has(error)

  if (input.interval && input.pausedAt) return 'paused'
  if (quota && input.interval) return 'quota'
  if (input.interval && !nextRunAt) return 'delayed'
  if (input.consecutiveFailures > 0 || (error && input.interval && nextRunAt)) return 'delayed'
  if (input.interval && nextRunAt) return monitoringIsOverdue(nextRunAt, input.now) ? 'delayed' : 'watching'
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

/** A configured schedule is covered only while its due commitment is current. */
export function watchIsCovered(state: WatchBoardState): boolean {
  return state === 'watching'
}
