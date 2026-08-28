'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import type { ReportOwnerActionContext } from '@/components/report/FlagDetailPanel'

interface LiveReportExplorerProps {
  model: ReportExplorerModel
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  className?: string
  loading?: boolean
  auditId?: string
  demonstratedFlagId?: string
  ownerActionContext?: ReportOwnerActionContext
}

export function LiveReportExplorer({
  model,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  className,
  loading = false,
  auditId,
  demonstratedFlagId,
  ownerActionContext,
}: LiveReportExplorerProps) {
  if (model.flags.length === 0 && !loading) return null

  return (
    <ReportExplorer
      model={model}
      layout="detail"
      showFeedback={showFeedback}
      aiLocked={aiLocked}
      aiEnhancementPending={aiEnhancementPending}
      signUpHref={signUpHref}
      className={className}
      loading={loading}
      auditId={auditId}
      demonstratedFlagId={demonstratedFlagId}
      ownerActionContext={ownerActionContext}
    />
  )
}
