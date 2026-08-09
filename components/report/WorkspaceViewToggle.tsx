'use client'

import { REPORT_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

export type WorkspacePanelView = 'browser' | 'report' | 'canvas'

interface WorkspaceViewToggleProps {
  view: WorkspacePanelView
  onChange: (view: WorkspacePanelView) => void
  className?: string
  showCanvas?: boolean
}

const views: Array<{ id: WorkspacePanelView; label: 'reportView' | 'browserView' | 'canvasView' }> = [
  { id: 'report', label: 'reportView' },
  { id: 'browser', label: 'browserView' },
  { id: 'canvas', label: 'canvasView' },
]

export function WorkspaceViewToggle({
  view,
  onChange,
  className,
  showCanvas = false,
}: WorkspaceViewToggleProps) {
  return (
    <div
      className={cn(
        'inline-flex rounded-card border border-border bg-muted/40 p-0.5 text-xs font-medium',
        className,
      )}
      role="tablist"
      aria-label={REPORT_COPY.workspace.panels.toggleLabel}
    >
      {views.filter((item) => item.id !== 'canvas' || showCanvas).map((item) => (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={view === item.id}
          className={cn(
            'min-h-11 rounded-md px-3 py-1.5 transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-2',
            view === item.id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground',
          )}
          onClick={() => onChange(item.id)}
        >
          {REPORT_COPY.workspace.panels[item.label]}
        </button>
      ))}
    </div>
  )
}
