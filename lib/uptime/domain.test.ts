import { describe, expect, it } from 'vitest'
import { currentUptimeState, uptimeTimeline, uptimeTransition, UPTIME_CONFIRMATION_MS } from './domain'

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
    expect(currentUptimeState({ enabled: true, state: 'online', lastCheckedAt: new Date(now.getTime() - 11 * 60_000), now })).toBe('unknown')
    expect(currentUptimeState({ enabled: false, state: 'online', lastCheckedAt: now, now })).toBe('paused')
  })
  it('keeps missing periods unknown and consolidates confirmation attempts into their original slot', () => {
    const probes = Array.from({ length: 6 }, (_, index) => ({ scheduledAt: new Date(now.getTime() - (6 - index) * 5 * 60_000).toISOString(),
      observedAt: new Date(now.getTime() - (6 - index) * 5 * 60_000).toISOString(), attempt: 1, result: 'ONLINE' as const, confirmed: false }))
    const complete = uptimeTimeline(probes, now)
    expect(complete).toHaveLength(48)
    expect(complete.at(-1)).toMatchObject({ state: 'online', checked: 6 })
    expect(complete[0].state).toBe('unknown')
    expect(uptimeTimeline(probes.slice(1), now).at(-1)?.state).toBe('unknown')
    expect(uptimeTimeline([...probes, { ...probes[0], attempt: 2, result: 'FAILED', confirmed: true }], now).at(-1)).toMatchObject({ state: 'offline', checked: 6 })
  })
})
