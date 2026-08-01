'use client'

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
        'inline-flex rounded-lg border border-border bg-muted/40 p-0.5 text-xs font-medium',
        className
      )}
      role="tablist"
      aria-label="Workspace view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={view === 'browser'}
        className={cn(
          'rounded-md px-3 py-1.5 transition-colors',
          view === 'browser' ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground'
        )}
        onClick={() => onChange('browser')}
      >
        Browser view
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
        Report view
      </button>
    </div>
  )
}
