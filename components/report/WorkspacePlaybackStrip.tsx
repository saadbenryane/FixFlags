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
  /** 0-based index of the selected step, or null when playing live. */
  activeIndex?: number | null
  onSelectStep?: (index: number) => void
  onScrub?: (index: number) => void
  className?: string
}

export function WorkspacePlaybackStrip({
  steps,
  activeIndex,
  onSelectStep,
  onScrub,
  className,
}: WorkspacePlaybackStripProps) {
  if (steps.length === 0) return null

  const selected =
    activeIndex != null && activeIndex >= 0 && activeIndex < steps.length
      ? activeIndex
      : -1

  return (
    <div
      className={cn(
        'rounded-card border border-border bg-muted/30 px-3 py-2',
        className
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">
          {REPORT_COPY.workspace.playback.label}
        </span>
        <span className="font-mono text-xs text-muted-foreground tabular-nums">
          {REPORT_COPY.workspace.playback.counter(
            selected >= 0 ? selected + 1 : 0,
            steps.length
          )}
        </span>
      </div>

      <input
        type="range"
        min={0}
        max={steps.length - 1}
        step={1}
        value={selected >= 0 ? selected : 0}
        onChange={(event) => onScrub?.(Number(event.target.value))}
        aria-label={REPORT_COPY.workspace.playback.scrubLabel}
        className="mt-2 w-full accent-brand"
      />

      <ol
        className="mt-2 flex items-center gap-2 overflow-x-auto"
        aria-label={REPORT_COPY.workspace.playback.label}
      >
        {steps.map((step, index) => (
          <li key={step.id} className="shrink-0 list-none">
            <button
              type="button"
              aria-pressed={index === selected}
              className={cn(
                'min-h-11 rounded-md px-2 text-xs font-medium transition-colors',
                index === selected
                  ? 'bg-brand text-brand-foreground'
                  : 'bg-background text-muted-foreground hover:text-foreground'
              )}
              onClick={() => onSelectStep?.(index)}
            >
              {REPORT_COPY.workspace.playback.stepNumber(index + 1)} · {step.label}
            </button>
          </li>
        ))}
      </ol>
    </div>
  )
}
