import type { SampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import {
  buildReportWorkspaceModel,
  type ReportWorkspaceModel,
} from '@/lib/report/workspace-model'

export function buildCuratedSampleWorkspaceModel(
  report: SampleReportDisplay
): ReportWorkspaceModel {
  const explorer = buildSampleExplorerModel(report, { promptAccess: 'one' })
  return buildReportWorkspaceModel({
    kind: 'sample',
    explorer,
    auditId: report.id,
    url: report.url,
    pageType: report.pageType,
    checkedAt: report.completedAt,
    status: 'completed',
    history: report.scoreHistory,
    capabilities: {
      canReplayTimeline: true,
      canChat: false,
      canUseCanvas: false,
      canShare: false,
      canRecheck: false,
      canGiveFeedback: false,
      promptAccess: 'demonstrated',
      demonstratedFlagId: report.demonstratedFlagId,
    },
  })
}
