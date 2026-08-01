'use client'

import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

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

interface WorkspacePlaybackStripProps {
  steps: PlaybackStep[]
  activeStepId?: string | null
  onSelectStep?: (id: string) => void
  className?: string
}

export function WorkspacePlaybackStrip({
  steps,
  activeStepId,
  onSelectStep,
  className,
}: WorkspacePlaybackStripProps) {
  if (steps.length === 0) return null

  return (
    <ol
      className={cn(
        'flex items-center gap-2 overflow-x-auto rounded-card border border-border bg-muted/30 px-3 py-2',
        className
      )}
      aria-label={REPORT_COPY.workspace.playback.label}
    >
      {steps.map((step, index) => (
        <li key={step.id} className="shrink-0 list-none">
          <button
            type="button"
            aria-pressed={activeStepId === step.id}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-medium transition-colors',
              activeStepId === step.id
                ? 'bg-brand text-brand-foreground'
                : 'bg-background text-muted-foreground hover:text-foreground'
            )}
            onClick={() => onSelectStep?.(step.id)}
          >
            {index + 1}. {step.label}
          </button>
        </li>
      ))}
    </ol>
  )
}
