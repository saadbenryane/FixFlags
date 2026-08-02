import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import {
  WorkspacePlaybackStrip,
  buildPlaybackSteps,
} from '@/components/report/WorkspacePlaybackStrip'
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

describe('WorkspacePlaybackStrip', () => {
  it('renders nothing when there are no steps', () => {
    const { container } = render(
      <WorkspacePlaybackStrip steps={[]} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders the scrub range covering the full step set', () => {
    render(<WorkspacePlaybackStrip steps={buildPlaybackSteps(fixtureEvents)} />)
    const scrub = screen.getByRole('slider')
    expect(scrub).toHaveAttribute('type', 'range')
    expect(scrub).toHaveAttribute('min', '0')
    expect(scrub).toHaveAttribute('max', String(fixtureEvents.length - 1))
  })

  it('marks the selected step and notifies on scrub', () => {
    const onScrub = vi.fn()
    render(
      <WorkspacePlaybackStrip
        steps={buildPlaybackSteps(fixtureEvents)}
        activeIndex={1}
        onScrub={onScrub}
      />
    )
    expect(screen.getByRole('button', { name: /Step 2 · Click pricing/ })).toHaveAttribute(
      'aria-pressed',
      'true'
    )
    fireEvent.change(screen.getByRole('slider'), { target: { value: '3' } })
    expect(onScrub).toHaveBeenCalledWith(3)
  })

  it('selects a step marker on click', () => {
    const onSelectStep = vi.fn()
    render(
      <WorkspacePlaybackStrip steps={buildPlaybackSteps(fixtureEvents)} onSelectStep={onSelectStep} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Step 4 · Final page/ }))
    expect(onSelectStep).toHaveBeenCalledWith(3)
  })
})
