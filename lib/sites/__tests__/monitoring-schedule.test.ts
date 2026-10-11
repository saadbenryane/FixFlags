import { describe, expect, it } from 'vitest'
import { nextCheckCompactLabel, nextCheckLabel, scheduleFromWatch, scheduleInterval } from '../monitoring-schedule'
import { watchScheduleSchema } from '../watch-schedule'
import { calcWatchNextRun } from '@/lib/audit/watch-interval'

describe('monitoring schedule presentation', () => {
  it('shows the remaining daily interval after a check 15 minutes ago', () => {
    expect(nextCheckLabel('2026-10-12T09:00:00.000Z', Date.parse('2026-10-11T09:15:00.000Z'))).toBe('Next check in 23 hours and 45 minutes')
    expect(nextCheckCompactLabel('2026-10-12T09:00:00.000Z', Date.parse('2026-10-11T09:15:00.000Z'))).toBe('Next in 23h 45m')
    expect(nextCheckCompactLabel('2026-10-14T09:00:00.000Z', Date.parse('2026-10-11T09:15:00.000Z'))).toBe('Next in 2d 23h 45m')
  })

  it('distinguishes overdue, absent and invalid schedules', () => {
    expect(nextCheckLabel('2026-10-11T09:00:00.000Z', Date.parse('2026-10-11T09:15:00.000Z'))).toBe('Next check due now')
    expect(nextCheckLabel(null, 0)).toBe('No next check scheduled')
    expect(nextCheckLabel('invalid', 0)).toBe('No next check scheduled')
    expect(nextCheckCompactLabel('invalid', 0)).toBe('Not scheduled')
    expect(nextCheckCompactLabel(new Date(0).toISOString(), 0)).toBe('Due now')
  })

  it('maps preset and custom schedules to live intervals', () => {
    expect(scheduleInterval({ every: 3, unit: 'hours' })).toBe('custom')
    expect(scheduleInterval({ every: 3, unit: 'days' })).toBe('custom')
    expect(scheduleInterval({ every: 1, unit: 'hours' })).toBe('hourly')
    expect(scheduleInterval({ every: 1, unit: 'days' })).toBe('daily')
    expect(scheduleInterval({ every: 7, unit: 'days' })).toBe('weekly')
    expect(scheduleInterval(null)).toBeNull()
  })

  it('restores custom timing and calculates the worker next run', () => {
    const now = new Date('2026-10-11T09:00:00.000Z')
    expect(scheduleFromWatch('custom', 180)).toEqual({ every: 3, unit: 'hours' })
    expect(scheduleFromWatch('custom', 4320)).toEqual({ every: 3, unit: 'days' })
    expect(calcWatchNextRun('custom', now, 180).toISOString()).toBe('2026-10-11T12:00:00.000Z')
    expect(calcWatchNextRun('custom', now, 4320).toISOString()).toBe('2026-10-14T09:00:00.000Z')
    expect(calcWatchNextRun('hourly', now).toISOString()).toBe('2026-10-11T10:00:00.000Z')
  })

  it.each([undefined, 0, -60, 30, 61, 90, 180.5, 3679260])('rejects invalid custom minutes %s', everyMinutes => {
    expect(watchScheduleSchema.safeParse({ interval: 'custom', everyMinutes }).success).toBe(false)
  })
})
