'use client'

import type { ActionTimelineEvent } from '@/lib/audit/action-timeline'
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { cn } from '@/lib/utils'

interface WorkspaceActivityPanelProps {
  events: ActionTimelineEvent[]
  className?: string
}

export function WorkspaceActivityPanel({ events, className }: WorkspaceActivityPanelProps) {
  if (events.length === 0) return null
  return (
    <div className={cn('rounded-lg border border-border bg-card/50 p-3', className)}>
      <p className="mb-2 text-xs font-semibold text-muted-foreground">Activity</p>
      <ActionTimeline events={events} className="text-xs" />
    </div>
  )
}
