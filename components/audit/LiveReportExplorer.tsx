'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'
import type { JourneyPage } from '@/components/audit/JourneyBar'

interface LiveReportExplorerProps {
  model: ReportExplorerModel
  showFeedback?: boolean
  aiLocked?: boolean
  aiEnhancementPending?: boolean
  signUpHref?: string
  className?: string
  pages?: JourneyPage[]
  loading?: boolean
  auditId?: string
  demonstratedFlagId?: string
}

export function LiveReportExplorer({
  model,
  showFeedback = false,
  aiLocked = false,
  aiEnhancementPending = false,
  signUpHref,
  className,
  pages,
  loading = false,
  auditId,
  demonstratedFlagId,
}: LiveReportExplorerProps) {
  if (model.flags.length === 0 && !loading) return null

  return (
    <ReportExplorer
      model={model}
      variant="live"
      showFeedback={showFeedback}
      aiLocked={aiLocked}
      aiEnhancementPending={aiEnhancementPending}
      signUpHref={signUpHref}
      className={className}
      pages={pages}
      loading={loading}
      auditId={auditId}
      demonstratedFlagId={demonstratedFlagId}
    />
  )
}
