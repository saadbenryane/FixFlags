import { describe, it, expect } from 'vitest'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'

const fixtureEvents: ActionTimelineEvent[] = [
  { t: 0, kind: 'navigate', label: 'Load homepage', url: 'https://example.com', screenshot: 'ss-home' },
  { t: 1200, kind: 'click', label: 'Click pricing', screenshot: 'ss-pricing' },
  { t: 2400, kind: 'form', label: 'Submit form', status: 200 },
  { t: 3600, kind: 'capture', label: 'Final page', screenshot: 'ss-final', url: 'https://example.com/thanks' },
]

describe('buildPlaybackSteps', () => {
  it('converts timeline events to playback steps with correct ids', () => {
    const steps = buildPlaybackSteps(fixtureEvents)
    expect(steps.map((s) => s.id)).toEqual([
      'navigate-0',
      'click-1',
      'form-2',
      'capture-3',
    ])
  })

  it('maps eventIndex to the source array position', () => {
    const steps = buildPlaybackSteps(fixtureEvents)
    steps.forEach((step, i) => {
      expect(step.eventIndex).toBe(i)
    })
  })

  it('carries screenshot and url from the source event', () => {
    const steps = buildPlaybackSteps(fixtureEvents)
    expect(steps[0]).toMatchObject({ screenshot: 'ss-home', url: 'https://example.com' })
    expect(steps[1]).toMatchObject({ screenshot: 'ss-pricing', url: undefined })
    expect(steps[3]).toMatchObject({ screenshot: 'ss-final', url: 'https://example.com/thanks' })
  })

  it('labels each step from the event label', () => {
    const steps = buildPlaybackSteps(fixtureEvents)
    expect(steps.map((s) => s.label)).toEqual([
      'Load homepage',
      'Click pricing',
      'Submit form',
      'Final page',
    ])
  })

  it('returns an empty array for empty events', () => {
    expect(buildPlaybackSteps([])).toEqual([])
  })

  it('truncates at MAX_PLAYBACK_STEPS (12)', () => {
    const events = Array.from({ length: 20 }, (_, i) => ({
      t: i * 1000,
      kind: 'navigate' as const,
      label: `Event ${i}`,
    }))
    const steps = buildPlaybackSteps(events)
    expect(steps).toHaveLength(12)
    expect(steps[11].id).toBe('navigate-11')
  })
})