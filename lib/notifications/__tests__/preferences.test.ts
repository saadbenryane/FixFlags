import { describe, expect, it } from 'vitest'
import { DEFAULT_NOTIFICATION_PREFERENCES as defaults, nextSummaryAt, notificationPreferencesSchema, summaryCadence } from '../preferences'

describe('summary scheduling', () => {
  it('follows the fastest monitoring schedule, with weekly for slower sites', () => {
    expect(summaryCadence(defaults, [])).toBeNull()
    expect(summaryCadence(defaults, [{ watchInterval: 'WEEKLY', watchEveryMinutes: null }])).toBe('WEEKLY')
    expect(summaryCadence(defaults, [{ watchInterval: 'CUSTOM', watchEveryMinutes: 120 }])).toBe('DAILY')
    expect(summaryCadence({ ...defaults, cadence: 'OFF' }, [{ watchInterval: 'DAILY', watchEveryMinutes: null }])).toBeNull()
  })
  it('respects local time, weekly day and exact delivery boundaries', () => {
    expect(nextSummaryAt({ ...defaults, timeZone: 'Asia/Kathmandu' }, 'DAILY', new Date('2026-10-29T00:00:00Z'))?.toISOString()).toBe('2026-10-29T03:15:00.000Z')
    expect(nextSummaryAt(defaults, 'DAILY', new Date('2026-10-29T09:00:00Z'))?.toISOString()).toBe('2026-10-30T09:00:00.000Z')
    expect(nextSummaryAt(defaults, 'WEEKLY', new Date('2026-10-29T00:00:00Z'))?.toISOString()).toBe('2026-11-02T09:00:00.000Z')
  })
  it('moves a skipped hour forward and sends once during a repeated hour', () => {
    const spring = { ...defaults, timeZone: 'America/New_York', hour: 2 }
    expect(nextSummaryAt(spring, 'DAILY', new Date('2026-03-08T00:00:00Z'))?.toISOString()).toBe('2026-03-08T07:00:00.000Z')
    const autumn = { ...spring, hour: 1 }
    expect(nextSummaryAt(autumn, 'DAILY', new Date('2026-11-01T00:00:00Z'))?.toISOString()).toBe('2026-11-01T05:00:00.000Z')
    expect(nextSummaryAt(autumn, 'DAILY', new Date('2026-11-01T05:10:00Z'))?.toISOString()).toBe('2026-11-02T06:00:00.000Z')
  })
  it('refuses invalid times, unknown zones and extra recipient fields', () => {
    for (const patch of [{ hour: 24 }, { weekday: -1 }, { timeZone: 'not/a-zone' }, { to: 'someone@example.com' }])
      expect(notificationPreferencesSchema.safeParse({ ...defaults, ...patch }).success).toBe(false)
  })
})
