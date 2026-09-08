import type { SampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import { buildReviewWorkspaceProjection } from '@/lib/report/review-workspace-projection'

export function buildCuratedSampleReviewWorkspaceProjection(
  report: SampleReportDisplay
) {
  const explorer = buildSampleExplorerModel(report, { promptAccess: 'one' })
  return buildReviewWorkspaceProjection({
    kind: 'sample',
    explorer,
    visibility: 'curated_sample',
    isAuthenticated: false,
    reviewId: report.id,
    url: report.url,
    pageType: report.pageType,
    checkedAt: report.completedAt,
    history: report.scoreHistory,
    demonstratedFlagId: report.demonstratedFlagId,
  })
}
