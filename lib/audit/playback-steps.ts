import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'

export interface PlaybackStep {
  id: string
  label: string
  /** Index into the source action timeline so selection can sync with activity. */
  eventIndex: number
  screenshot?: string | null
  url?: string
}

const MAX_PLAYBACK_STEPS = 12

export function buildPlaybackSteps(events: ActionTimelineEvent[]): PlaybackStep[] {
  return events.slice(0, MAX_PLAYBACK_STEPS).map((event, index) => ({
    id: `${event.kind}-${index}`,
    label: event.label,
    eventIndex: index,
    screenshot: event.screenshot ?? null,
    url: event.url,
  }))
}
