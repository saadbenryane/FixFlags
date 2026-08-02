import type { ReactNode } from 'react'
import {
  ReportWorkspaceShell,
  type ReportWorkspaceShellProps,
} from '@/components/report/ReportWorkspaceShell'

export type ReportWorkspaceFrameMode = 'live' | 'complete' | 'sample' | 'preview'

export interface ReportWorkspaceFrameProps extends ReportWorkspaceShellProps {
  mode?: ReportWorkspaceFrameMode
  /** Optional density hint for marketing/sample surfaces */
  density?: 'default' | 'hero' | 'compact'
}

/**
 * Single composition entry for report workspaces across live, completed,
 * sample, and marketing preview surfaces. Wraps ReportWorkspaceShell so
 * route-specific composers share one layout contract.
 */
export function ReportWorkspaceFrame({
  mode = 'complete',
  density = 'default',
  compact,
  className,
  ...shellProps
}: ReportWorkspaceFrameProps) {
  const resolvedCompact = compact ?? (density === 'compact' || density === 'hero')
  return (
    <div data-workspace-mode={mode} className={className}>
      <ReportWorkspaceShell {...shellProps} compact={resolvedCompact} />
    </div>
  )
}

export function ReportWorkspaceFrameSection({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <section className={className}>{children}</section>
}
