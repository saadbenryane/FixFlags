import { describe, expect, it } from 'vitest'
import { watchBoardState, watchIsCovered, watchBoardLabel } from '@/lib/sites/watch-state'

describe('watch board truth', () => {
  it('is covered only when a schedule exists', () => {
    expect(
      watchIsCovered(
        watchBoardState({
          interval: 'weekly',
          nextRunAt: new Date('2026-09-15T00:00:00Z'),
          lastError: null,
          consecutiveFailures: 0,
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
        }),
        'weekly'
      )
    ).toBe('Watch paused')
    expect(
      watchBoardState({
        interval: 'weekly',
        nextRunAt: new Date('2026-09-15T00:00:00Z'),
        lastError: 'Watch paused because this month’s Site check allowance is used. It will resume after renewal or an upgrade.',
        consecutiveFailures: 0,
      })
    ).toBe('quota')
    expect(
      watchBoardState({
        interval: 'daily',
        nextRunAt: new Date('2026-09-09T00:00:00Z'),
        lastError: 'timeout',
        consecutiveFailures: 2,
      })
    ).toBe('delayed')
  })
})
