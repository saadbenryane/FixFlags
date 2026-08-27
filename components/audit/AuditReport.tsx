import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { REPORT_SECTION_SCROLL_MT, WORKSPACE_VIEWPORT_CLASS } from '@/components/report/workspace-geometry'
import { ReportPane } from '@/components/report/ReportPane'
import { VerificationReceiptsSection } from '@/components/report/VerificationReceiptsSection'
import type { ProductAttemptDTO } from '@/lib/products/workspace'
const LiveReportExplorer = dynamic(() =>
  import('@/components/audit/LiveReportExplorer').then(
    (m) => m.LiveReportExplorer
  )
)
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { TriageUnavailableCallout } from '@/components/audit/TriageUnavailableCallout'
import { REPORT_COPY, HERO, AUDIT_ERRORS } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { triageUnavailableBody } from '@/lib/audit/triage-unavailable'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import type { RubricComputed, ShareStatus } from '@/lib/audit/rubric'
import type { FixList } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import {
  RecheckDiffStrip,
  type RecheckDiffSummary,
} from '@/components/audit/RecheckDiffStrip'
import { RecheckCompletedTracker } from '@/components/audit/RecheckCompletedTracker'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import type { FlowData } from '@/lib/audit/flow-data'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { buildLiveExplorerModel } from '@/lib/report/explorer-model'
import { buildReportWorkspaceModel } from '@/lib/report/workspace-model'
import type { JourneyReviewSummary } from '@/components/audit/JourneyReviewTimeline'
import { ReportAuthGateTracker } from '@/components/analytics/ReportAuthGateTracker'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import type { AgentMessage } from '@/lib/audit/agent-message'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'
import { resolveReportSurfaceCapabilities, type AuditAccessContext } from '@/lib/audit/access-capabilities'

interface RubricRow {
  id: string
  name: string
  grade: string | null
  score: number | null
  status: string | null
  summary: string
  flags: RankableFlag[]
}

interface AuditReportProps {
  audit: {
    /** Exact validated access decision. Repository fixtures opt in explicitly. */
    accessContext: Exclude<AuditAccessContext, 'denied'> | 'repository_sample'
    pageType: string | null
    score: number | null
    url: string
    screenshots?: AuditScreenshot[]
    screenshotCapture?: ScreenshotCaptureStatus
    rubrics: RubricComputed[]
    rubricRows: RubricRow[]
    flags: RankableFlag[]
    shareStatus: ShareStatus
    launchReadiness?: LaunchReadinessData | null
    reportCompleteness?: 'FULL' | 'PARTIAL' | 'UNKNOWN'
    pipelineVersion?: string | null
    pipelineLog?: PipelineLogEvent[] | null
    startedAt?: string | Date | null
    completedAt?: string | Date | null
    parentId?: string | null
    pageSpeedCoverage?: import('@/lib/audit/pagespeed-coverage').PageSpeedCoverage
    previewMeta?: PreviewMeta | null
    flowData?: FlowData | null
    evidenceAnchors?: EvidenceAnchorMap
    flagVisualEvidence?: import('@/lib/audit/persist-visual-evidence').FlagVisualEvidenceMap
    actionTimeline?: import('@/lib/audit/action-timeline').ActionTimelineEvent[]
    productContract?:
      import('@/lib/audit/product-contract').ProductContract | null
    verifiedLearnings?: import('@/lib/audit/product-intelligence').VerifiedLearning[]
    intentionalNotes?: string[]
    knownRisks?: string[]
    failedModules?: string[]
    technologyProfile?: TechnologyProfile
    reviewCoverage?: unknown
    fixList?: FixList
  }
  auditId?: string
  /** Immutable curated observation identity. Never treated as a live audit id. */
  observationId?: string
  viewerIsPaid: boolean
  viewerPlan?: string
  isLoggedIn: boolean
  variant?: 'default' | 'sample'
  showMonitoringHint?: boolean
  projectId?: string | null
  canWatchProduct?: boolean
  canDailyWatch?: boolean
  watchInterval?: 'weekly' | 'daily' | null
  atAuditLimit?: boolean
  /** Per-device capture outcome, so the stage can say "failed" instead of spinning. */
  captureStatus?: ScreenshotCaptureStatus | null
  showPrescription?: boolean
  showDeterministicFixes?: boolean
  aiReviewPending?: boolean
  triageDegraded?: boolean
  prescriptionFailed?: boolean
  failureCode?: string | null
  actions?: ReactNode
  toolbarActions?: ReactNode
  journeyReviews?: JourneyReviewSummary[]
  recheckDiff?: RecheckDiffSummary | null
  verificationReceipts?: ProductAttemptDTO[]
  scoreHistory?: ReportWorkspaceHistoryPoint[]
  compareHref?: string | null
  sampleFixFlag?: RankableFlag | null
  agentMessages?: AgentMessage[]
  /** Persisted or curated Product name; the hostname stays the fallback. */
  productName?: string | null
}

export function AuditReport({
  audit,
  auditId,
  observationId,
  viewerIsPaid,
  viewerPlan = 'FREE',
  isLoggedIn,
  variant = 'default',
  showMonitoringHint = false,
  projectId = null,
  canWatchProduct = false,
  canDailyWatch = false,
  watchInterval = null,
  atAuditLimit = false,
  captureStatus = null,
  showPrescription = true,
  showDeterministicFixes = true,
  aiReviewPending = false,
  triageDegraded = false,
  prescriptionFailed = false,
  failureCode = null,
  actions,
  toolbarActions,
  journeyReviews: _journeyReviews = [],
  recheckDiff = null,
  verificationReceipts = [],
  scoreHistory = [],
  compareHref = null,
  sampleFixFlag = null,
  agentMessages = [],
  productName = null,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const isRepositorySample =
    isSample && audit.accessContext === 'repository_sample'
  const isOwnerAccess = audit.accessContext === 'owner'
  const surface = resolveReportSurfaceCapabilities({
    accessContext: audit.accessContext,
    isLoggedIn,
    isRepositorySample,
  })
  const chatGate = surface.chat
  const promptProjection = surface.prompt
  const signUpHref = auditId
    ? `/sign-up?next=/report/${auditId}&from=report`
    : '/sign-up?from=report'
  const chatGateReason = chatGate.gateReason
  void showMonitoringHint
  void canWatchProduct
  void canDailyWatch
  void watchInterval
  void _journeyReviews
  void projectId
  void toolbarActions

  // Server strip is the only entitlement; never unlock via client sessionStorage.
  const fixPromptLocked = !showDeterministicFixes
  const demonstratedFlag = sampleFixFlag

  const upgradeMoment =
    !isSample && isLoggedIn && !viewerIsPaid
      ? resolveFreeUserUpgradeMoment({ atAuditLimit })
      : null

  const explorerModel = buildLiveExplorerModel({
    url: audit.url,
    pageType: audit.pageType,
    score: audit.score,
    flags: audit.flags,
    screenshots: audit.screenshots,
    rubricRows: audit.rubricRows,
    evidenceAnchors: audit.evidenceAnchors,
    previewMeta: audit.previewMeta,
    flagVisualEvidence: audit.flagVisualEvidence,
    productContract: audit.productContract ?? null,
    promptAccess: promptProjection.explorer,
    demonstratedFlag,
    fixList: audit.fixList,
    reviewCoverage: audit.reviewCoverage,
    reportCompleteness: audit.reportCompleteness,
  })
  const completedAt =
    audit.completedAt instanceof Date
      ? audit.completedAt
      : audit.completedAt
        ? new Date(audit.completedAt)
        : null
  const isPartialReport = audit.reportCompleteness === 'PARTIAL'
  const workspace = buildReportWorkspaceModel({
    kind: isSample ? 'sample' : 'completed',
    explorer: explorerModel,
    auditId: auditId ?? observationId,
    url: audit.url,
    pageType: audit.pageType,
    checkedAt: completedAt,
    status: isPartialReport
      ? 'partial'
      : triageDegraded
        ? 'degraded'
        : 'completed',
    history: scoreHistory,
    capabilities: {
      promptAccess: promptProjection.workspace,
      canReplayTimeline: false,
      canChat: !isSample && chatGate.canChat && Boolean(auditId),
      canUseCanvas: false,
      canShare: !isSample && isLoggedIn && isOwnerAccess,
      canExport: !isSample && isLoggedIn && isOwnerAccess,
      canRecheck: !isSample && isLoggedIn && isOwnerAccess,
      canGiveFeedback: !isSample && isLoggedIn && isOwnerAccess,
      demonstratedFlagId: demonstratedFlag?.id ?? null,
    },
  })
  const showFeedback = workspace.capabilities.canGiveFeedback
  const unresolvedFlagCount = workspace.outcome.unresolvedCount
  const showStatusCallouts =
    !isSample &&
    (aiReviewPending ||
      triageDegraded ||
      prescriptionFailed ||
      isPartialReport ||
      (audit.failedModules?.length ?? 0) > 0)

  const flagsExplorer =
    unresolvedFlagCount > 0 ? (
      <LiveReportExplorer
        model={explorerModel}
        showFeedback={showFeedback}
        aiLocked={fixPromptLocked}
        aiEnhancementPending={isLoggedIn && aiReviewPending}
        signUpHref={signUpHref}
        auditId={auditId}
        demonstratedFlagId={demonstratedFlag?.id}
        ownerActionContext={
          auditId && isLoggedIn && isOwnerAccess && !isSample
            ? { auditId, surface: 'focused', accessState: 'owner' }
            : undefined
        }
      />
    ) : null

  const flagsSection =
    unresolvedFlagCount > 0 ? (
      <section
        id="report-flags"
        className={cn(REPORT_SECTION_SCROLL_MT, 'flex min-h-0 flex-1 flex-col')}
      >
        {flagsExplorer}
      </section>
    ) : (
      <section id="report-flags" className={REPORT_SECTION_SCROLL_MT}>
        <Callout variant="neutral" title={REPORT_COPY.noFlags.title}>
          {REPORT_COPY.noFlags.body}
        </Callout>
      </section>
    )

  const statusCallouts =
    !isSample && showStatusCallouts ? (
      <div className="space-y-3">
        {aiReviewPending ? (
          <Callout variant="info" title={REPORT_COPY.aiPending.title}>
            {REPORT_COPY.aiPending.body}
          </Callout>
        ) : null}
        {prescriptionFailed ? (
          <Callout
            variant="warning"
            title={REPORT_COPY.prescriptionUnavailable.title}
          >
            {AUDIT_ERRORS.partialAiReview}
          </Callout>
        ) : null}
        {triageDegraded && auditId ? (
          <TriageUnavailableCallout
            auditId={auditId}
            failureCode={failureCode}
            isLoggedIn={isLoggedIn}
            canRetry={workspace.capabilities.canRecheck}
            signUpHref={signUpHref}
          />
        ) : null}
        {triageDegraded && !auditId ? (
          <Callout
            variant="warning"
            title={REPORT_COPY.triageUnavailable.title}
          >
            {triageUnavailableBody(failureCode, isLoggedIn)}
          </Callout>
        ) : null}
        {isPartialReport && !triageDegraded ? (
          <Callout variant="warning" title={REPORT_COPY.partialReport.title}>
            {REPORT_COPY.partialReport.body}
          </Callout>
        ) : null}
        {(audit.failedModules?.length ?? 0) > 0 ? (
          <Callout variant="warning" title={REPORT_COPY.failedChecks.title}>
            {REPORT_COPY.failedChecks.body(audit.failedModules ?? [])}
          </Callout>
        ) : null}
      </div>
    ) : null

  const frameExtras = (
    <>
      {statusCallouts}
      {!isSample && recheckDiff ? (
        <>
          {auditId && audit.parentId ? (
            <RecheckCompletedTracker
              auditId={auditId}
              parentAuditId={audit.parentId}
              outcome="report_diff"
            />
          ) : null}
          <RecheckDiffStrip summary={recheckDiff} compareHref={compareHref} />
        </>
      ) : null}
      {!isSample && verificationReceipts.length > 0 ? (
        <VerificationReceiptsSection receipts={verificationReceipts} />
      ) : null}
    </>
  )

  const showSampleCta = isSample
  const showRunYourOwn = !isSample && !workspace.capabilities.canRecheck
  const showUpgradeCard =
    !isSample &&
    isLoggedIn &&
    !viewerIsPaid &&
    showPrescription &&
    Boolean(upgradeMoment) &&
    upgradeMoment !== 'free_default'

  const reportActions = showSampleCta || showRunYourOwn || showUpgradeCard ? (
    <div className="mt-3 space-y-5">
      {showSampleCta ? (
        <div className="space-y-3 rounded-card border border-border/50 bg-muted/15 p-5 text-center sm:p-6">
          <p className="text-sm font-semibold">
            {REPORT_COPY.sampleCta.title}
          </p>
          <p className="text-pretty text-sm text-muted-foreground">
            {REPORT_COPY.sampleCta.body}
          </p>
          <Button asChild variant="brand">
            <Link href="/#audit">{HERO.primaryCta}</Link>
          </Button>
        </div>
      ) : null}
      {showRunYourOwn ? (
        <p className="text-center text-sm text-muted-foreground">
          <Link
            href="/#audit"
            className="text-link font-medium underline-offset-2 hover:underline"
          >
            {REPORT_COPY.runYourOwnAudit}
          </Link>
        </p>
      ) : null}
      {showUpgradeCard && upgradeMoment ? (
        <ContextualUpgradeCard
          moment={upgradeMoment}
          isLoggedIn
          currentPlan={viewerPlan}
          auditId={auditId}
        />
      ) : null}
    </div>
  ) : null

  const livingReportPanel = (
    <ReportPane
      beforeExplorer={frameExtras}
      explorer={flagsSection}
      afterFrame={reportActions}
    />
  )

  if (auditId) {
    return (
      <>
        <div
          className={cn(
            'flex min-h-0 flex-col',
            // Marketing /samples embeds this editor in a fixed card. A 100dvh
            // shell inside that card clips the docked transport.
            isSample ? 'h-full' : WORKSPACE_VIEWPORT_CLASS
          )}
        >
          <Suspense fallback={null}>
            <ReportWorkspaceSplitShell
              capabilities={workspace.capabilities}
              reportHeader={
                <ReportOutcomeBar model={workspace} actions={actions} />
              }
              leftPanel={
                <WorkspaceChatPanel
                  auditId={auditId}
                  capabilities={workspace.capabilities}
                  gateReason={chatGateReason}
                  claimReason={chatGate.claimReason}
                  agentMessages={agentMessages}
                  reportUrl={audit.url}
                  productName={productName}
                />
              }
              browserUrl={audit.url}
              browserScreenshots={audit.screenshots}
              browserCaptureStatus={captureStatus}
              reportPanel={livingReportPanel}
              steps={[]}
              className="h-full"
            />
          </Suspense>
        </div>
        <ReportAuthGateTracker auditId={auditId} gateShown={fixPromptLocked} />
      </>
    )
  }

  // Curated sample without a live audit id (marketing embedding).
  return (
    <div className="flex h-full min-h-[32rem] min-w-0 flex-col">
      <Suspense fallback={null}>
        <ReportWorkspaceSplitShell
          capabilities={workspace.capabilities}
          reportHeader={
            <ReportOutcomeBar model={workspace} actions={actions} />
          }
          leftPanel={
            <WorkspaceChatPanel
              capabilities={workspace.capabilities}
              gateReason="owner"
              agentMessages={agentMessages}
              reportUrl={audit.url}
              productName={productName}
            />
          }
          browserUrl={audit.url}
          browserScreenshots={audit.screenshots}
          browserCaptureStatus={captureStatus}
          reportPanel={livingReportPanel}
          steps={[]}
          className="h-full min-h-[32rem]"
        />
      </Suspense>
    </div>
  )
}
