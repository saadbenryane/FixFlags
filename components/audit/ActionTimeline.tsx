'use client'

import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'

interface ActionTimelineProps {
  events: ActionTimelineEvent[]
  emptyLabel?: string
  className?: string
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function ActionTimeline({
  events,
  emptyLabel = 'Scan steps will appear as FixFlags checks the page.',
  className,
}: ActionTimelineProps) {
  if (!events.length) {
    return (
      <p className={`text-sm text-muted-foreground ${className ?? ''}`}>{emptyLabel}</p>
    )
  }

  return (
    <ol className={`space-y-2 ${className ?? ''}`} aria-label="Scan action timeline">
      {events.map((event, index) => (
        <li
          key={`${event.t}-${event.kind}-${index}`}
          className="flex gap-3 text-sm"
        >
          <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground tabular-nums pt-0.5">
            {formatElapsed(event.t)}
          </span>
          <span className="min-w-0 flex-1">
            <span className="text-foreground">{event.label}</span>
            {event.status != null && (
              <span className="ml-2 font-mono text-xs text-muted-foreground">
                {String(event.status)}
              </span>
            )}
            {event.url && (
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {event.url}
              </span>
            )}
          </span>
        </li>
      ))}
    </ol>
  )
}
