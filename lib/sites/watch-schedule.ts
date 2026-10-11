import { z } from 'zod'

export const WATCH_INTERVALS = ['weekly', 'daily', 'hourly', 'custom'] as const
export type WatchInterval = (typeof WATCH_INTERVALS)[number]
export const MAX_WATCH_MINUTES = 365 * 7 * 24 * 60

export const watchIntervalSchema = z.enum(WATCH_INTERVALS)
export const watchScheduleSchema = z.object({
  interval: watchIntervalSchema.nullable(),
  everyMinutes: z.number().int().min(60).max(MAX_WATCH_MINUTES).multipleOf(60).optional(),
}).superRefine((schedule, context) => {
  if (schedule.interval === 'custom' && schedule.everyMinutes === undefined) context.addIssue({ code: 'custom', message: 'Choose a custom check interval.', path: ['everyMinutes'] })
  if (schedule.interval !== 'custom' && schedule.everyMinutes !== undefined) context.addIssue({ code: 'custom', message: 'Custom timing requires a custom schedule.', path: ['everyMinutes'] })
})

export function watchIntervalMinutes(interval: WatchInterval, everyMinutes?: number | null): number {
  if (interval === 'custom') {
    if (typeof everyMinutes !== 'number' || !Number.isInteger(everyMinutes) || everyMinutes < 60 || everyMinutes > MAX_WATCH_MINUTES || everyMinutes % 60 !== 0) throw new Error('Invalid custom monitoring interval')
    return everyMinutes
  }
  return { hourly: 60, daily: 1440, weekly: 10080 }[interval]
}
