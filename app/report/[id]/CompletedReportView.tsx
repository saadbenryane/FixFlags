import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditReport } from '@/components/audit/AuditReport'
import { AiReviewPendingRefresh } from '@/components/audit/AiReviewPendingRefresh'
import { AuditShell } from '@/components/layout/audit-shell'
import { isAdminUser } from '@/lib/auth/permissions'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import type { loadReportRouteState } from './load-report-route-state'
import { ReportPromptsUnlockedTracker } from '@/components/report/ReportPromptsUnlockedTracker'
import { ReportViewedTracker } from '@/components/analytics/ReportViewedTracker'
import { buildFixFlagsScanMessages } from '@/lib/audit/scan-agent-messages'
import { BRAND } from '@/lib/marketing/copy'
import { publicReportStructuredData } from '@/lib/marketing/structured-data'
import { displayHostname } from '@/lib/utils/url-helpers'

type CompletedState = Extract<
  Awaited<ReturnType<typeof loadReportRouteState>>,
  { kind: 'completed' }
>

function parseCaptureStatus(audit: unknown): ScreenshotCaptureStatus | undefined {
  if (typeof audit !== 'object' || audit === null) return undefined
  const capture = (audit as Record<string, unknown>).screenshotCapture
  if (typeof capture !== 'object' || capture === null) return undefined
  const value = capture as Record<string, unknown>
  return typeof value.desktop === 'string' && typeof value.mobile === 'string'
    ? (capture as ScreenshotCaptureStatus)
    : undefined
}

export function CompletedReportView({ state }: { state: CompletedState }) {
  const journeyReviews = (state.audit.journeyReviews ?? []).map((review) => ({
    id: review.id,
    journeyType: review.journeyType,
    status: review.status,
    goalAchieved: review.goalAchieved,
    completedSteps: review.completedSteps,
    findingsCount: review._count.findings,
    steps: review.steps,
  }))
  const captureStatus = parseCaptureStatus(state.audit)
  const agentMessages = buildFixFlagsScanMessages({
    id: state.id,
    url: state.audit.url,
    status: state.audit.status,
    progress: state.audit.progress,
    startedAt: state.audit.startedAt,
    completedAt: state.audit.completedAt,
    reportCompleteness: state.audit.reportCompleteness,
    failureCode: state.audit.failureCode,
    journeyReviewIncluded: state.audit.journeyReviewIncluded,
    journeyReviewAt: state.audit.journeyReviewAt,
    screenshotCapture: captureStatus,
    flags: state.flags.map((flag) => ({
      id: flag.id,
      problem: flag.problem,
      rubric: flag.rubric,
      severity: flag.severity,
      checkId: flag.checkId,
      impactTag: flag.impactTag,
      pageUrl: flag.pageUrl,
    })),
  })
  const headerActions = (
    <AuditPageActions
      auditId={state.id}
      url={state.audit.url}
      score={state.audit.score}
      verdict={state.audit.verdict}
      flags={state.flags}
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
      isLoggedIn={state.isLoggedIn}
      isOwner={state.isOwner}
      isClaimedAnonymous={state.reportAudit.accessContext === 'anonymous_teaser'}
      canExportSummary={state.entitlements?.canExportSummary ?? false}
      showFixPrompts={state.showDeterministicFixes}
      variant="all"
    />
  )

  const isIndexableReport =
    !state.shareToken && (state.audit.isPublic || state.audit.userId === null)
  const reportJsonLd = isIndexableReport
    ? publicReportStructuredData({
        reportId: state.id,
        reviewedUrl: state.audit.url,
        title: `${displayHostname(state.audit.url)} report · ${BRAND.name}`,
        description:
          state.audit.verdict?.slice(0, 140) ??
          `Automated FixFlags report with fix prompts. Run your own check at ${BRAND.name}.`,
      })
    : null

  return (
    <AuditShell
      session={state.session}
      immersive
      claimReason={state.reportAudit.accessContext === 'anonymous_teaser' ? 'save-report' : 'create-account'}
      showAdmin={
        state.user && state.session
          ? isAdminUser({ id: state.session.user.id, role: state.user.role })
          : false
      }
    >
      {reportJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(reportJsonLd) }}
        />
      ) : null}
      <ReportViewedTracker
        auditId={state.id}
        isOwner={state.isOwner}
        accessState={
          state.isOwner ? 'owner' : state.isLoggedIn ? 'signed_in' : 'anonymous'
        }
        surface={state.isMarketingSample ? 'sample' : state.shareToken ? 'shared' : 'focused'}
      />
      <div>
        <AuditReport
          audit={state.reportAudit}
          auditId={state.id}
          viewerIsPaid={state.viewerIsPaid}
          viewerPlan={state.user?.plan ?? 'FREE'}
          isLoggedIn={state.isLoggedIn}
          variant={state.isMarketingSample ? 'sample' : 'default'}
          showMonitoringHint={state.isLoggedIn && state.isOwner}
          projectId={state.audit.projectId}
          canWatchProduct={state.entitlements?.canWatchProduct ?? false}
          canDailyWatch={state.isLoggedIn && state.isOwner}
          watchInterval={
            state.audit.watchInterval === 'weekly' || state.audit.watchInterval === 'daily'
              ? state.audit.watchInterval
              : null
          }
          atAuditLimit={state.atAuditLimit}
          captureStatus={captureStatus}
          showPrescription={state.showPrescription}
          showDeterministicFixes={state.showDeterministicFixes}
          aiReviewPending={state.aiReviewPending}
          triageDegraded={state.triageDegraded}
          prescriptionFailed={state.prescriptionFailed}
          failureCode={state.audit.failureCode ?? null}
          journeyReviews={journeyReviews}
          recheckDiff={state.recheckDiff}
          verificationReceipts={state.verificationReceipts}
          scoreHistory={state.scoreHistory}
          sampleFixFlag={state.sampleFixFlag}
          reportCompleteness={state.audit.reportCompleteness}
          actions={headerActions}
          agentMessages={agentMessages}
        />
        <AiReviewPendingRefresh auditId={state.id} enabled={state.aiReviewPending} />
      </div>
      {state.isOwner && state.showPrescription && !state.aiReviewPending ? (
        <ReportPromptsUnlockedTracker
          auditId={state.id}
          promptCount={state.flags.length}
        />
      ) : null}
    </AuditShell>
  )
}
