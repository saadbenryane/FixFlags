import { AuditPageActions } from '@/components/audit/AuditPageActions'
import { AuditReport } from '@/components/audit/AuditReport'
import { AiReviewPendingRefresh } from '@/components/audit/AiReviewPendingRefresh'
import { AuditShell } from '@/components/layout/audit-shell'
import { isAdminUser } from '@/lib/auth/permissions'
import type { loadReportRouteState } from './load-report-route-state'
import { ReportPromptsUnlockedTracker } from '@/components/report/ReportPromptsUnlockedTracker'
import { ReportViewedTracker } from '@/components/analytics/ReportViewedTracker'
import { BRAND } from '@/lib/marketing/copy'
import { publicReportStructuredData } from '@/lib/marketing/structured-data'
import { displayHostname } from '@/lib/utils/url-helpers'

type CompletedState = Extract<
  Awaited<ReturnType<typeof loadReportRouteState>>,
  { kind: 'completed' | 'partial' }
>

export function CompletedReportView({ state }: { state: CompletedState }) {
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
          projection={state.projection}
          audit={state.reportAudit}
          auditId={state.id}
          viewerIsPaid={state.viewerIsPaid}
          viewerPlan={state.user?.plan ?? 'FREE'}
          isLoggedIn={state.isLoggedIn}
          atAuditLimit={state.atAuditLimit}
          showPrescription={state.showPrescription}
          showDeterministicFixes={state.showDeterministicFixes}
          aiReviewPending={state.aiReviewPending}
          triageDegraded={state.triageDegraded}
          prescriptionFailed={state.prescriptionFailed}
          failureCode={state.audit.failureCode ?? null}
          recheckDiff={state.recheckDiff}
          verificationReceipts={state.verificationReceipts}
          actions={headerActions}
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
