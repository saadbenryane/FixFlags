import type { SampleReportDisplay } from '@/lib/marketing/sample-report-display'
import { buildSampleExplorerModel } from '@/lib/report/explorer-model'
import {
  buildReportWorkspaceModel,
  type ReportWorkspaceHistoryPoint,
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
    launchReadiness: report.readiness,
    checkedScope: 'the curated demo page',
    demonstratedFlagId: report.demonstratedFlagId,
  })
}

export function buildDashboardWorkspaceModel(input: {
  explorer: ReportWorkspaceModel['explorer']
  auditId: string
  url: string
  pageType?: string | null
  checkedAt: Date
  history: ReportWorkspaceHistoryPoint[]
  shareStatus?: 'good_to_share' | 'fix_before_sharing' | null
  launchReadiness?: 'safe' | 'fix_first' | 'not_ready' | 'unknown' | null
}): ReportWorkspaceModel {
  return buildReportWorkspaceModel({
    kind: 'dashboard',
    explorer: input.explorer,
    auditId: input.auditId,
    url: input.url,
    pageType: input.pageType,
    checkedAt: input.checkedAt,
    status: 'completed',
    history: input.history,
    shareStatus: input.shareStatus,
    launchReadiness: input.launchReadiness,
    checkedScope: 'the latest completed release',
    canRecheck: true,
  })
}
