import type { Metadata } from 'next'
import { AuditPageClient } from '@/components/audit/AuditPageClient'
import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditReport } from '@/components/audit/AuditReport'
import { AiReviewPendingRefresh } from '@/components/audit/AiReviewPendingRefresh'
import { McpFixNudge } from '@/components/audit/McpFixNudge'
import { AuditShell } from '@/components/layout/audit-shell'
import { ReportAccessDeniedStatus } from '@/components/ui/status-page'
import { isAdminUser } from '@/lib/auth/permissions'
import {
  normalizeInternalScreenshotUrl,
  resolveScreenshotUx,
  type AuditScreenshot,
  type ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { loadReportRouteState } from '../load-report-route-state'

export const metadata: Metadata = {
  title: 'Full review',
  robots: { index: false, follow: false },
}

function parseScreenshots(value: unknown): AuditScreenshot[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is AuditScreenshot =>
      item !== null && typeof item === 'object' && 'device' in item && 'url' in item
    )
    .map((item) => ({
      ...item,
      url: typeof item.url === 'string' ? normalizeInternalScreenshotUrl(item.url) : '',
    }))
    .filter((item) => item.url.length > 0)
}

function parseCaptureStatus(audit: unknown): ScreenshotCaptureStatus | undefined {
  if (typeof audit !== 'object' || audit === null) return undefined
  const capture = (audit as Record<string, unknown>).screenshotCapture
  if (typeof capture !== 'object' || capture === null) return undefined
  const value = capture as Record<string, unknown>
  return typeof value.desktop === 'string' && typeof value.mobile === 'string'
    ? (capture as ScreenshotCaptureStatus)
    : undefined
}

export async function DetailedReportRoute({
  params,
  shareToken,
}: {
  params: Promise<{ id: string }>
  shareToken?: string
}) {
  const state = await loadReportRouteState(params, shareToken)
  if (state.kind === 'forbidden') {
    return <AuditShell session={null}><ReportAccessDeniedStatus /></AuditShell>
  }
  if (state.kind === 'progressive') {
    return <AuditPageClient id={state.id} initialAudit={state.audit} pollStatus session={state.session} />
  }
  if (state.kind !== 'completed') {
    return null
  }

  const completedState = state
  const finishPlanFlags = completedState.finishPlanFlags ?? completedState.reportAudit.flags

  const journeyPages = (completedState.audit.pages ?? []).map((page) => ({
    id: page.id,
    url: page.url,
    title: page.title,
    role: page.role,
    position: page.position,
    flagCount: page.flags.length,
    criticalCount: page.flags.filter((flag) => flag.severity === 'CRITICAL').length,
    importantCount: page.flags.filter((flag) => flag.severity === 'IMPORTANT').length,
  }))
  const journeyReviews = (state.audit.journeyReviews ?? []).map((review) => ({
    id: review.id,
    journeyType: review.journeyType,
    status: review.status,
    goalAchieved: review.goalAchieved,
    completedSteps: review.completedSteps,
    findingsCount: review._count.findings,
    steps: review.steps,
  }))
  const screenshots = parseScreenshots(state.audit.screenshots)
  const captureStatus = parseCaptureStatus(state.audit)
  const { limited, partial } = resolveScreenshotUx(screenshots, captureStatus)
  const compareAuditId = state.canAccessCompareView
    ? state.audit.parentId ? state.id : state.latestMonitoring?.id ?? null
    : null
  const toolbarActions = (
    <AuditPageActions
      auditId={state.id}
      url={state.audit.url}
      score={state.audit.score}
      verdict={state.audit.verdict}
      topIssue={state.topIssue}
      flags={finishPlanFlags}
      contract={state.reportAudit.productContract ?? null}
      finishPlanPrompt={completedState.finishPlan?.copyPrompt ?? null}
      rubrics={state.rubricRows.map((rubric) => ({
        name: rubric.name,
        grade: rubric.grade,
        score: rubric.score,
        rubricPrompt: rubric.rubricPrompt,
        flags: rubric.flags.map((flag) => ({
          severity: flag.severity,
          problem: flag.problem,
          rubric: flag.rubric,
        })),
      }))}
      isPaid={state.viewerIsPaid}
      isLoggedIn={state.isLoggedIn}
      isOwner={state.isOwner}
      isAnonymous={state.isAnonymous}
      isPublic={state.audit.isPublic}
      compareAuditId={compareAuditId}
      canExportSummary={state.entitlements?.canExportSummary ?? false}
      canSharePublicly={state.entitlements?.canSharePublicly ?? false}
      showFixPrompts={state.showDeterministicFixes}
      toolbar
    />
  )

  return (
    <AuditShell
      session={state.session}
      showAdmin={state.user && state.session
        ? isAdminUser({ id: state.session.user.id, role: state.user.role })
        : false}
    >
      <AuditReport
        audit={state.reportAudit}
        auditId={state.id}
        viewerIsPaid={state.viewerIsPaid}
        viewerPlan={state.user?.plan ?? 'FREE'}
        isLoggedIn={state.isLoggedIn}
        isViewerOwner={state.isOwner}
        variant={state.isMarketingSample ? 'sample' : 'default'}
        showMonitoringHint={state.isLoggedIn && state.isOwner}
        projectId={state.audit.projectId}
        canWatchProduct={state.entitlements?.canWatchProduct ?? false}
        canDailyWatch={(state.user?.plan ?? 'FREE') === 'TEAM'}
        watchInterval={
          state.audit.watchInterval === 'weekly' || state.audit.watchInterval === 'daily'
            ? state.audit.watchInterval
            : null
        }
        atAuditLimit={state.atAuditLimit}
        screenshotLimited={limited}
        screenshotPartial={partial}
        showPrescription={state.showPrescription}
        showDeterministicFixes={state.showDeterministicFixes}
        aiReviewPending={state.aiReviewPending}
        triageDegraded={state.triageDegraded}
        prescriptionFailed={state.prescriptionFailed}
        failureCode={state.audit.failureCode ?? null}
        pages={journeyPages}
        journeyReviews={journeyReviews}
        recheckDiff={state.recheckDiff}
        sampleFixFlag={state.sampleFixFlag}
        compareHref={state.canAccessCompareView && state.audit.parentId
          ? `/compare/${state.id}`
          : null}
        toolbarActions={toolbarActions}
        backToPlanHref={shareToken ? `/share/${shareToken}` : `/report/${state.id}`}
        showFinishPlan={false}
        finishPlan={completedState.finishPlan}
      />
      <McpFixNudge auditId={state.id} isPaid={state.viewerIsPaid} />
      <AiReviewPendingRefresh auditId={state.id} enabled={state.aiReviewPending} />
    </AuditShell>
  )
}

export default function ReportDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  return <DetailedReportRoute params={params} />
}
