'use client'

import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

interface WorkspaceActivityPanelProps {
  events: ActionTimelineEvent[]
  /** Sync the playback strip selection to the matching activity row. */
  highlightIndex?: number | null
  className?: string
}

export function WorkspaceActivityPanel({
  events,
  highlightIndex,
  className,
}: WorkspaceActivityPanelProps) {
  if (events.length === 0) return null
  return (
    <div className={cn('rounded-card border border-border bg-card/50 p-3', className)}>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">
        {REPORT_COPY.workspace.activity}
      </p>
      <ActionTimeline events={events} highlightIndex={highlightIndex} className="text-xs" />
    </div>
  )
}
