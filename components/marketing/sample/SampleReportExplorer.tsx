'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import type { SampleReportDisplay } from '@/lib/marketing/sample-report-display'

interface SampleReportExplorerProps {
  report: SampleReportDisplay
  variant?: 'hero' | 'live'
  className?: string
  initialFlagIndex?: number
}

export function SampleReportExplorer({
  report,
  variant = 'hero',
  className,
  initialFlagIndex = 0,
}: SampleReportExplorerProps) {
  const model = buildSampleExplorerModel(report)

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
