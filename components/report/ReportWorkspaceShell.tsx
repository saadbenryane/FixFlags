import type { ReactNode } from 'react'
import { Container } from '@/components/ui/container'
import { ReportWorkspaceOutcome } from '@/components/report/ReportWorkspaceChrome'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

export interface ReportWorkspaceShellProps {
  workspace: ReportWorkspaceModel
  hero: ReactNode
  progressBand: ReactNode
  stickyNav?: ReactNode | null
  polishPass?: ReactNode | null
  flagsSection: ReactNode
  contextSections?: ReactNode | null
  footerSections?: ReactNode | null
  beforeProgress?: ReactNode | null
  afterProgress?: ReactNode | null
  compact?: boolean
  className?: string
}

/**
 * Canonical report layout: status → action → work → context.
 * Shared by progressive and completed report surfaces.
 */
export function ReportWorkspaceShell({
  workspace,
  hero,
  progressBand,
  stickyNav,
  polishPass,
  flagsSection,
  contextSections,
  footerSections,
  beforeProgress,
  afterProgress,
  compact = false,
  className,
}: ReportWorkspaceShellProps) {
  return (
    <Container
      variant="report"
      className={cn(
        compact ? 'space-y-4 pb-4 sm:pb-6' : 'space-y-5 py-5 sm:space-y-6 sm:py-6',
        className
      )}
    >
      {hero}

      <ReportWorkspaceOutcome model={workspace} compact={compact} />

      {beforeProgress}

      {afterProgress}

      {progressBand}

      {stickyNav}

      {polishPass}

      {flagsSection}

      {contextSections}

      {footerSections}
    </Container>
  )
}

export const REPORT_SECTION_SCROLL_MT = 'scroll-mt-[var(--report-chrome-offset)]'
