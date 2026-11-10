import { describe, expect, it } from 'vitest'
import { currentUptimeState, uptimeTimeline, uptimeTimelineBounds, uptimeTimelineSegments, uptimeTransition, UPTIME_CONFIRMATION_MS } from './domain'

const now = new Date('2026-10-12T12:30:00.000Z')
describe('recorded Uptime transitions', () => {
  it('confirms a failure after 30 seconds and recovers only on a successful probe', () => {
    const first = uptimeTransition({ result: 'FAILED', now, confirmation: false, pendingFailureAt: null, incidentOpen: false })
    expect(first.state).toBe('checking')
    expect(first.event).toBeNull()
    expect(first.confirmAt?.getTime()).toBe(now.getTime() + UPTIME_CONFIRMATION_MS)
    const failed = uptimeTransition({ result: 'FAILED', now: first.confirmAt!, confirmation: true, pendingFailureAt: first.pendingFailureAt, incidentOpen: false })
    expect(failed).toMatchObject({ state: 'offline', event: 'opened' })
    expect(uptimeTransition({ result: 'FAILED', now, confirmation: false, pendingFailureAt: null, incidentOpen: true }).event).toBeNull()
    expect(uptimeTransition({ result: 'UNKNOWN', now, confirmation: false, pendingFailureAt: null, incidentOpen: true }).event).toBeNull()
    expect(uptimeTransition({ result: 'ONLINE', now, confirmation: false, pendingFailureAt: null, incidentOpen: true }).event).toBe('recovered')
  })
  it('does not turn a transient or blocked confirmation into an outage', () => {
    for (const result of ['ONLINE', 'UNKNOWN'] as const) {
      expect(uptimeTransition({ result, now, confirmation: true, pendingFailureAt: now, incidentOpen: false })).toMatchObject({ event: null, pendingFailureAt: null })
    }
  })
  it('shows stale observations as unknown and disabled monitoring as paused', () => {
    expect(currentUptimeState({ enabled: true, state: 'online', lastCheckedAt: new Date(now.getTime() - 21 * 60_000), now })).toBe('unknown')
    expect(currentUptimeState({ enabled: false, state: 'online', lastCheckedAt: now, now })).toBe('paused')
  })
  it('keeps missing periods unknown and consolidates confirmation attempts into their original slot', () => {
    const probes = Array.from({ length: 3 }, (_, index) => ({ scheduledAt: new Date(now.getTime() - (3 - index) * 10 * 60_000).toISOString(),
      observedAt: new Date(now.getTime() - (3 - index) * 10 * 60_000).toISOString(), attempt: 1, result: 'ONLINE' as const, confirmed: false }))
    const complete = uptimeTimeline(probes, now)
    expect(complete).toHaveLength(48)
    expect(complete.at(-1)).toMatchObject({ state: 'online', checked: 3 })
    expect(complete[0].state).toBe('unknown')
    expect(uptimeTimeline(probes.slice(1), now).at(-1)?.state).toBe('unknown')
    expect(uptimeTimeline([...probes, { ...probes[0], attempt: 2, result: 'FAILED', confirmed: true }], now).at(-1)).toMatchObject({ state: 'offline', checked: 3 })
  })

  it('cannot fill a missed ten-minute slot with a second retained timestamp in another slot', () => {
    const probes = [-20, -10, -1].map(minutes => {
      const scheduledAt = new Date(now.getTime() + minutes * 60_000).toISOString()
      return { scheduledAt, observedAt: scheduledAt, attempt: 1, result: 'ONLINE' as const, confirmed: false }
    })
    expect(uptimeTimeline(probes, now).at(-1)).toMatchObject({ state: 'unknown', checked: 2, expected: 3 })
    const confirmed = { ...probes.at(-1)!, result: 'FAILED' as const, confirmed: true }
    expect(uptimeTimeline([...probes.slice(0, -1), confirmed], now).at(-1))
      .toMatchObject({ state: 'offline', checked: 2, expected: 3 })
  })

  it('counts a slot starting exactly at the read time in the current partial period', () => {
    const at = new Date('2026-10-12T12:10:00.000Z')
    const first = { scheduledAt: '2026-10-12T12:00:00.000Z', observedAt: '2026-10-12T12:00:01.000Z',
      attempt: 1, result: 'ONLINE' as const, confirmed: false }
    expect(uptimeTimeline([first], at).at(-1)).toMatchObject({ state: 'unknown', checked: 1, expected: 2 })
    expect(uptimeTimeline([first, { ...first, scheduledAt: at.toISOString(), observedAt: at.toISOString() }], at).at(-1))
      .toMatchObject({ state: 'online', checked: 2, expected: 2 })
  })

  it('starts a new Site history when monitoring began, without unknown periods before it', () => {
    const bounds = uptimeTimelineBounds(now, '24h')
    const segments = uptimeTimelineSegments(bounds, new Map(), new Date('2026-10-12T12:05:00.000Z').getTime())
    expect(segments.slice(0, -1).every(segment => segment.expected === 0 && segment.state === 'unknown')).toBe(true)
    expect(segments.at(-1)).toMatchObject({ startAt: '2026-10-12T12:00:00.000Z', expected: 3 })
    expect(uptimeTimelineSegments(bounds, new Map(), Infinity).every(segment => segment.expected === 0)).toBe(true)
    expect(uptimeTimelineSegments(bounds, new Map())[0].expected).toBe(3)
  })
})
