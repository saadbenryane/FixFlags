import { describe, expect, it } from 'vitest'
import { outcomeFreshnessMinutes, siteCoverageMaxAgeMs, siteCoverageIsStale } from '../evidence-freshness'

describe('care evidence freshness', () => {
  it.each([
    [null, undefined, 192, 192], ['weekly', undefined, 192, 192], ['daily', undefined, 36, 36],
    ['hourly', undefined, 36, 13], ['custom', 180, 36, 15], ['custom', 4320, 84, 84],
    ['custom', 20160, 192, 348],
  ] as const)('bounds broad evidence independently of %s bindings (%s minutes)', (interval, everyMinutes, broadHours, outcomeHours) => {
    expect(siteCoverageMaxAgeMs(interval, everyMinutes)).toBe(broadHours * 3600_000)
    expect(outcomeFreshnessMinutes(interval, everyMinutes)).toBe(outcomeHours * 60)
  })

  it('expires at the current cadence boundary and refuses missing or invalid evidence dates', () => {
    const checkedAt = new Date('2026-10-20T12:00:00Z'), maxAge = siteCoverageMaxAgeMs('daily')
    expect(siteCoverageIsStale(checkedAt, new Date(checkedAt.getTime() + maxAge - 1), maxAge)).toBe(false)
    const now = new Date(checkedAt.getTime() + maxAge)
    for (const date of [checkedAt, checkedAt.toISOString(), null, 'not a date'])
      expect(siteCoverageIsStale(date, now, maxAge)).toBe(true)
    expect(siteCoverageIsStale(checkedAt, now)).toBe(false)
  })
})
