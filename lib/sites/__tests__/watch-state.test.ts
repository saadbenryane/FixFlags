import { describe, expect, it } from 'vitest'
import { watchBoardState, watchIsCovered, watchBoardLabel } from '@/lib/sites/watch-state'

describe('watch board truth', () => {
  it('does not claim monitoring coverage after its due commitment is overdue', () => {
    const now = new Date('2026-10-20T12:00:00Z')
    const overdue = watchBoardState({ interval: 'daily', nextRunAt: new Date('2026-10-20T11:54:59Z'),
      lastError: null, consecutiveFailures: 0, now })
    expect(overdue).toBe('delayed')
    expect(watchIsCovered(overdue)).toBe(false)
  })
  it.each([
    ['2026-10-20T12:01:00Z', 'watching'],
    ['2026-10-20T12:00:00Z', 'watching'],
    ['2026-10-20T11:55:00Z', 'watching'],
    ['2026-10-20T11:54:59.999Z', 'delayed'],
    ['2026-10-01T12:00:00Z', 'delayed'],
    ['invalid-date', 'delayed'],
  ] as const)('classifies due time %s as %s using the operator sweep tolerance', (nextRunAt, expected) => {
    expect(watchBoardState({ interval: 'weekly', nextRunAt, lastError: null, consecutiveFailures: 0,
      now: new Date('2026-10-20T12:00:00Z') })).toBe(expected)
  })
  it('is covered only when a current schedule exists', () => {
    expect(
      watchIsCovered(
        watchBoardState({
          interval: 'weekly',
          nextRunAt: new Date('2026-09-15T00:00:00Z'),
          lastError: null,
          consecutiveFailures: 0,
          now: new Date('2026-09-14T00:00:00Z'),
        })
      )
    ).toBe(true)
    expect(
      watchIsCovered(
        watchBoardState({
          interval: 'weekly',
          nextRunAt: null,
          lastError: 'Paused. This Site is not on a check schedule.',
          consecutiveFailures: 0,
          now: new Date('2026-09-14T00:00:00Z'),
        })
      )
    ).toBe(false)
  })

  it('names paused, delayed, and quota states', () => {
    expect(
      watchBoardLabel(
        watchBoardState({
          interval: 'weekly',
          nextRunAt: null,
          lastError: 'Paused. This Site is not on a check schedule.',
          consecutiveFailures: 0,
          now: new Date('2026-09-14T00:00:00Z'),
        }),
        'weekly'
      )
    ).toBe('Paused')
    expect(
      watchBoardState({
        interval: 'weekly',
        nextRunAt: new Date('2026-09-15T00:00:00Z'),
        lastError: 'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
        consecutiveFailures: 0,
        now: new Date('2026-09-14T00:00:00Z'),
      })
    ).toBe('quota')
    expect(
      watchBoardState({
        interval: 'daily',
        nextRunAt: new Date('2026-09-09T00:00:00Z'),
        lastError: 'timeout',
        consecutiveFailures: 2,
        now: new Date('2026-09-14T00:00:00Z'),
      })
    ).toBe('delayed')
  })
})
