'use client'

import { SegmentedControl } from '@/components/ui/segmented-control'
import { REPORT_COPY } from '@/lib/marketing/copy'

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
  const items = views
    .filter((item) => item.id !== 'canvas' || showCanvas)
    .map((item) => ({
      value: item.id,
      label: REPORT_COPY.workspace.panels[item.label],
    }))

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
