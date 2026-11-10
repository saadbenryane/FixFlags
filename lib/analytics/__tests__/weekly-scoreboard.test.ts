import { describe, expect, it } from 'vitest'
import { calculateWeeklyScoreboard, weekStartUtc } from '../weekly-scoreboard'

const at = (iso: string) => new Date(iso)

describe('weekly scoreboard', () => {
  it('starts weeks on Monday in UTC', () => {
    expect(weekStartUtc(at('2026-11-10T15:00:00Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z')
    expect(weekStartUtc(at('2026-11-09T00:00:00Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z')
    expect(weekStartUtc(at('2026-11-15T23:59:59Z')).toISOString()).toBe('2026-11-09T00:00:00.000Z')
  })

  it('counts only independently verified fixes toward the North Star', () => {
    const rows = calculateWeeklyScoreboard([
      { name: 'verify_result', createdAt: at('2026-11-10T10:00:00Z'), properties: { outcome: 'IMPROVED', comparable: true } },
      { name: 'verify_result', createdAt: at('2026-11-10T11:00:00Z'), properties: { outcome: 'UNCHANGED', comparable: true } },
      { name: 'verify_result', createdAt: at('2026-11-10T12:00:00Z'), properties: { outcome: 'INCONCLUSIVE', comparable: false } },
      { name: 'verify_result', createdAt: at('2026-11-03T12:00:00Z'), properties: { outcome: 'IMPROVED', comparable: true } },
    ], at('2026-11-11T00:00:00Z'), 3)
    expect(rows.map(row => [row.weekStart, row.verifiedFixes])).toEqual([
      ['2026-11-09', 1], ['2026-11-02', 1], ['2026-10-26', 0],
    ])
  })

  it('counts first checks but not rechecks or scheduled runs, and ignores events outside the window', () => {
    const [week] = calculateWeeklyScoreboard([
      { name: 'analyze_started', createdAt: at('2026-11-09T01:00:00Z'), properties: { trigger: 'manual', anonymous: true } },
      { name: 'analyze_started', createdAt: at('2026-11-09T02:00:00Z'), properties: { trigger: 'watch' } },
      { name: 'analyze_started', createdAt: at('2026-11-09T02:30:00Z'), properties: { trigger: 'MANUAL', firstCheck: false } },
      { name: 'analyze_started', createdAt: at('2026-11-09T02:40:00Z'), properties: { trigger: 'manual', firstCheck: true } },
      { name: 'site_claimed', createdAt: at('2026-11-09T03:00:00Z'), properties: {} },
      { name: 'fix_handoff', createdAt: at('2026-11-09T04:00:00Z'), properties: null },
      { name: 'verify_started', createdAt: at('2026-11-09T05:00:00Z'), properties: {} },
      { name: 'watch_enabled', createdAt: at('2026-11-09T06:00:00Z'), properties: {} },
      { name: 'site_claimed', createdAt: at('2026-01-01T00:00:00Z'), properties: {} },
      { name: 'site_claimed', createdAt: at('2026-12-01T00:00:00Z'), properties: {} },
    ], at('2026-11-10T00:00:00Z'), 2)
    expect(week).toEqual({ weekStart: '2026-11-09', checks: 2, claimed: 1, fixHandoffs: 1, rechecks: 1, verifiedFixes: 0, watchEnabled: 1 })
  })
})
