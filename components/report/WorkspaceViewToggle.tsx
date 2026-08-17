'use client'

import { Eye, FileText, LayoutDashboard } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { REPORT_COPY } from '@/lib/marketing/copy'

export type WorkspacePanelView = 'browser' | 'report' | 'canvas'

interface WorkspaceViewToggleProps {
  view: WorkspacePanelView
  onChange: (view: WorkspacePanelView) => void
  className?: string
  showCanvas?: boolean
  /** Active-review mode: only Report and Preview, with Timeline relabeled as Preview. */
  scanning?: boolean
}

/** Preview/Timeline first, then Report, then Canvas. Matches Product chrome order. */
const views: Array<{ id: WorkspacePanelView; label: 'reportView' | 'browserView' | 'canvasView' }> = [
  { id: 'browser', label: 'browserView' },
  { id: 'report', label: 'reportView' },
  { id: 'canvas', label: 'canvasView' },
]

function viewIcon(id: WorkspacePanelView) {
  if (id === 'browser') return <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
  if (id === 'report') return <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
  return <LayoutDashboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
}

export function WorkspaceViewToggle({
  view,
  onChange,
  className,
  showCanvas = false,
  scanning = false,
}: WorkspaceViewToggleProps) {
  const items = views
    .filter((item) => item.id !== 'canvas' || (!scanning && showCanvas))
    .map((item) => {
      const text =
        scanning && item.id === 'browser'
          ? REPORT_COPY.workspace.panels.previewView
          : REPORT_COPY.workspace.panels[item.label]
      return {
        value: item.id,
        'aria-label': text,
        label: (
          <>
            {viewIcon(item.id)}
            <span className="hidden sm:inline">{text}</span>
          </>
        ),
      }
    })

  return (
    <SegmentedControl
      size="lg"
      value={view}
      onValueChange={(value) => onChange(value as WorkspacePanelView)}
      items={items}
      aria-label={REPORT_COPY.workspace.panels.toggleLabel}
      className={className}
    />
  )
}
