'use client'

import { ReportExplorer } from '@/components/report/ReportExplorer'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import type { SampleReportDisplay } from '@/lib/marketing/sample-report-display'

type ExplorerVariant = 'page' | 'hero'

interface SampleReportExplorerProps {
  report: SampleReportDisplay
  variant?: ExplorerVariant
  className?: string
  initialFlagIndex?: number
}

export function SampleReportExplorer({
  report,
  variant = 'page',
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
