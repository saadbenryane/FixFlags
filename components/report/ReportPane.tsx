import type { ReactNode } from 'react'
import { WORKSPACE_REPORT_FRAME_CLASS } from '@/components/report/workspace-geometry'
import { cn } from '@/lib/utils'

/**
 * Canonical Report-mode composition shared by completed, progressive, sample,
 * shared, and marketing Review surfaces. The fixed Score/history row belongs
 * to the workspace shell; this component owns the pane-scrolling body.
 */
export function ReportPane({
  beforeExplorer,
  explorer,
  afterFrame,
  className,
}: {
  beforeExplorer?: ReactNode
  explorer: ReactNode
  afterFrame?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col', className)}>
      <div data-report-frame className={WORKSPACE_REPORT_FRAME_CLASS}>
        {beforeExplorer}
        {explorer}
      </div>
      {afterFrame}
    </div>
  )
}
