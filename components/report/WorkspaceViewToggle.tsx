'use client'

import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type WorkspacePanelView = 'browser' | 'report'

interface WorkspaceViewToggleProps {
  view: WorkspacePanelView
  onChange: (view: WorkspacePanelView) => void
  className?: string
}

export function WorkspaceViewToggle({ view, onChange, className }: WorkspaceViewToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-card border border-border bg-muted/40 p-0.5 text-xs font-medium',
        className
      )}
      role="tablist"
      aria-label={REPORT_COPY.workspace.panels.toggleLabel}
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'browser'}
        className={cn(
          'min-h-11 rounded-md px-3 py-1.5 transition-colors',
          view === 'browser' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
        )}
        onClick={() => onChange('browser')}
      >
        {REPORT_COPY.workspace.panels.browserView}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={view === 'report'}
        className={cn(
          'rounded-md px-3 py-1.5 transition-colors',
          view === 'report' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
        )}
        onClick={() => onChange('report')}
      >
        {REPORT_COPY.workspace.panels.reportView}
      </button>
    </div>
  )
}
