'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'

interface LiveReportExplorerProps {
  model: ReportExplorerModel
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  hasFixPrompts?: boolean
  defaultSeverityFilter?: 'ALL' | 'CRITICAL' | 'IMPORTANT' | 'POLISH'
  className?: string
}

export function LiveReportExplorer({
  model,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  hasFixPrompts = true,
  defaultSeverityFilter = 'ALL',
  className,
}: LiveReportExplorerProps) {
  if (model.flags.length === 0) return null

  return (
    <ReportExplorer
      model={model}
      variant="live"
      showFeedback={showFeedback}
      aiLocked={aiLocked}
      aiEnhancementPending={aiEnhancementPending}
      signUpHref={signUpHref}
      hasFixPrompts={hasFixPrompts}
      defaultSeverityFilter={defaultSeverityFilter}
      className={className}
    />
  )
}
