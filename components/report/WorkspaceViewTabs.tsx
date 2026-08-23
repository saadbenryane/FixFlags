'use client'

import { Eye, FileText, LayoutDashboard } from 'lucide-react'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceCapabilities } from '@/lib/report/workspace-model'

export type WorkspacePanelView = 'browser' | 'report' | 'canvas'

interface WorkspaceViewTabsProps {
  view: WorkspacePanelView
  onChange: (view: WorkspacePanelView) => void
  hrefForView: (view: WorkspacePanelView) => string
  capabilities: ReportWorkspaceCapabilities
  panelId: string
  idPrefix: string
  className?: string
  scanning?: boolean
}

const views: Array<{
  id: WorkspacePanelView
  label: 'reportView' | 'browserView' | 'canvasView'
}> = [
  { id: 'browser', label: 'browserView' },
  { id: 'report', label: 'reportView' },
  { id: 'canvas', label: 'canvasView' },
]

function viewIcon(id: WorkspacePanelView) {
  if (id === 'browser') return <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
  if (id === 'report') return <FileText className="h-3.5 w-3.5 shrink-0" aria-hidden />
  return <LayoutDashboard className="h-3.5 w-3.5 shrink-0" aria-hidden />
}

/** URL-backed Review siblings with native-link fallback and WAI tab behavior. */
export function WorkspaceViewTabs({
  view,
  onChange,
  hrefForView,
  capabilities,
  panelId,
  idPrefix,
  className,
  scanning = false,
  hideBrowserView = false,
}: WorkspaceViewTabsProps & { hideBrowserView?: boolean }) {
  const items = views
    .filter((item) => item.id !== 'browser' || !hideBrowserView)
    .filter((item) => item.id !== 'canvas' || (!scanning && capabilities.canUseCanvas))
    .map((item) => {
      const text =
        scanning && item.id === 'browser'
          ? REPORT_COPY.workspace.panels.previewView
          : REPORT_COPY.workspace.panels[item.label]
      return {
        value: item.id,
        id: `${idPrefix}-${item.id}`,
        controls: panelId,
        href: hrefForView(item.id),
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
