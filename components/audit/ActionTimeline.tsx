'use client'

import { useEffect, useRef } from 'react'
import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { formatElapsedMs } from '@/lib/audit/progress-ui'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { displayEvidenceUrl } from '@/lib/utils/url-helpers'
import { cn } from '@/lib/utils'

interface ActionTimelineProps {
  events: ActionTimelineEvent[]
  emptyLabel?: string
  /** Sync selection from the playback strip to the matching activity row. */
  highlightIndex?: number | null
  /** Seek playback to the matching activity row. */
  onSelectRow?: (index: number) => void
  className?: string
}

export function ActionTimeline({
  events,
  emptyLabel = REPORT_COPY.sectionTitles.timelineEmpty,
  highlightIndex,
  onSelectRow,
  className,
}: ActionTimelineProps) {
  const highlightedRef = useRef<HTMLLIElement | null>(null)

  useEffect(() => {
    highlightedRef.current?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, [highlightIndex])

  if (!events.length) {
    return <p className={cn('text-sm text-muted-foreground', className)}>{emptyLabel}</p>
  }

  return (
    <ol
      className={cn('space-y-2', className)}
      aria-label={REPORT_COPY.workspace.activity}
    >
      {events.map((event, index) => {
        const urlLabel = displayEvidenceUrl(event.url)
        const isHighlighted = index === highlightIndex
        const rowClassName = cn(
          'flex gap-3 rounded-md px-2 py-1 text-sm',
          isHighlighted && 'border-l-2 border-brand bg-brand/5'
        )
        const rowContent = (
          <>
            <span className="w-12 shrink-0 font-mono text-xs text-muted-foreground tabular-nums pt-0.5">
              {formatElapsedMs(event.t)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-foreground">{event.label}</span>
              {event.status != null && (
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {String(event.status)}
                </span>
              )}
              {urlLabel && (
                <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                  {urlLabel}
                </span>
              )}
            </span>
          </>
        )
        return (
          <li
            key={`${event.t}-${event.kind}-${index}`}
            ref={isHighlighted ? highlightedRef : undefined}
            className={cn('list-none', onSelectRow && 'rounded-md')}
          >
            {onSelectRow ? (
              <button
                type="button"
                aria-pressed={isHighlighted}
                onClick={() => onSelectRow(index)}
                className={cn(rowClassName, 'w-full cursor-pointer text-left')}
              >
                {rowContent}
              </button>
            ) : (
              <div className={rowClassName}>{rowContent}</div>
            )}
          </li>
        )
      })}
    </ol>
  )
}
