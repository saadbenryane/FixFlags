'use client'

import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { REPORT_COPY } from '@/lib/marketing/copy'
import { WorkspacePanel } from '@/components/report/WorkspacePanel'

interface WorkspaceActivityPanelProps {
  events: ActionTimelineEvent[]
  /** Sync the playback strip selection to the matching activity row. */
  highlightIndex?: number | null
  /** Seek playback from the activity row. */
  onSelectEvent?: (index: number) => void
  className?: string
}

export function WorkspaceActivityPanel({
  events,
  highlightIndex,
  onSelectEvent,
  className,
}: WorkspaceActivityPanelProps) {
  if (events.length === 0) return null
  return (
    <WorkspacePanel label={REPORT_COPY.workspace.activity} className={className}>
      <ActionTimeline
        events={events}
        highlightIndex={highlightIndex}
        onSelectRow={onSelectEvent}
        className="text-xs"
      />
    </WorkspacePanel>
  )
}
