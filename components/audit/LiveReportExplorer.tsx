'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'

interface LiveReportExplorerProps {
  model: ReportExplorerModel
  showFeedback?: boolean
  aiLocked?: boolean
  signUpHref?: string
  hasFixPrompts?: boolean
  className?: string
}

export function LiveReportExplorer({
  model,
  showFeedback = false,
  aiLocked = false,
  signUpHref,
  hasFixPrompts = true,
  className,
}: LiveReportExplorerProps) {
  if (model.flags.length === 0) return null

  return (
    <ReportExplorer
      model={model}
      variant="live"
      showFeedback={showFeedback}
      aiLocked={aiLocked}
      signUpHref={signUpHref}
      hasFixPrompts={hasFixPrompts}
      className={className}
    />
  )
}
