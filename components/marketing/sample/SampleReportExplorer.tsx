'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import type { ReportExplorerModel } from '@/lib/report/explorer-model'

interface SampleReportExplorerProps {
  model: ReportExplorerModel
  variant?: 'hero' | 'live'
  className?: string
  initialFlagIndex?: number
}

export function SampleReportExplorer({
  model,
  variant = 'hero',
  className,
  initialFlagIndex = 0,
}: SampleReportExplorerProps) {
  return (
    <ReportExplorer
      model={model}
      variant={variant}
      className={className}
      initialFlagIndex={initialFlagIndex}
      hasFixPrompts
    />
  )
}
