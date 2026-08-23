import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'
import { ReportOutcomeBar } from '@/components/report/ReportOutcomeBar'
import { ReportContextDisclosure } from '@/components/report/ReportContextDisclosure'
import { ReportPolishPass } from '@/components/report/ReportPolishPass'
import { KeepReportEmail } from '@/components/report/KeepReportEmail'
import {
  REPORT_SECTION_SCROLL_MT,
} from '@/components/report/workspace-geometry'
import { ReportPane } from '@/components/report/ReportPane'
const LiveReportExplorer = dynamic(
  () => import('@/components/audit/LiveReportExplorer').then((m) => m.LiveReportExplorer)
)
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { TriageUnavailableCallout } from '@/components/audit/TriageUnavailableCallout'
import { SectionTitle } from '@/components/ui/typography'
import { Play } from 'lucide-react'
import { UPSELLS, REPORT_COPY, HERO, AUDIT_ERRORS } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { triageUnavailableBody } from '@/lib/audit/triage-unavailable'
import type {
  AuditScreenshot,
  ScreenshotCaptureStatus,
} from '@/lib/audit/screenshot-types'
import { AuditPipelineProof } from '@/components/audit/AuditPipelineProof'
import { ReportFeedback } from '@/components/report/ReportFeedback'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import type { RubricComputed, ShareStatus } from '@/lib/audit/rubric'
import type { FixList } from '@/lib/audit/finish-plan'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { LaunchGates } from '@/components/audit/LaunchGates'
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
import { resolveReportPromptProjection } from '@/lib/report/prompt-access'
import { JourneyBar, type JourneyPage } from '@/components/audit/JourneyBar'
import { FlowScanTimeline } from '@/components/audit/FlowScanTimeline'
import { PreviewCards } from '@/components/audit/PreviewCards'
import {
  JourneyReviewTimeline,
  type JourneyReviewSummary,
} from '@/components/audit/JourneyReviewTimeline'
import { ProductContractCard } from '@/components/audit/ProductContractCard'
import { ProductMemoryStrip } from '@/components/audit/ProductMemoryStrip'
import { ProductWatchControls } from '@/components/audit/ProductWatchControls'
import { ReportAuthGateTracker } from '@/components/analytics/ReportAuthGateTracker'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import { ReportCanvasPanel } from '@/components/report/ReportCanvasPanel'
import type { AgentMessage } from '@/lib/audit/agent-message'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'
import type { AuditAccessContext } from '@/lib/audit/access'

/** Sections carried by the Review context disclosure, so anchors can open it. */
const REPORT_CONTEXT_SECTION_IDS = [
  'report-stack',
  'report-contract',
  'report-remember',
  'report-funnel',
  'report-previews',
  'report-launch',
  'report-recheck',
]

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
    productContract?: import('@/lib/audit/product-contract').ProductContract | null
    verifiedLearnings?: import('@/lib/audit/product-intelligence').VerifiedLearning[]
    intentionalNotes?: string[]
    knownRisks?: string[]
    failedModules?: string[]
    technologyProfile?: TechnologyProfile
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
  pages?: JourneyPage[]
  journeyReviews?: JourneyReviewSummary[]
  recheckDiff?: RecheckDiffSummary | null
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
  pages = [],
  journeyReviews = [],
  recheckDiff = null,
  scoreHistory = [],
  compareHref = null,
  sampleFixFlag = null,
  agentMessages = [],
  productName = null,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const isRepositorySample = isSample && audit.accessContext === 'repository_sample'
  const isOwnerAccess = audit.accessContext === 'owner'
  const canClaimAccess = audit.accessContext === 'anonymous_teaser'
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}&from=report` : '/sign-up?from=report'
  const timelineGateActionHref = canClaimAccess && auditId
    ? `/sign-in?next=${encodeURIComponent(`/report/${auditId}`)}`
    : undefined
  const chatGateReason = canClaimAccess ? 'sign-in' : 'owner'
  const hasLaunchGates = (audit.launchReadiness?.checklist?.length ?? 0) > 0
  const showContract = Boolean(audit.productContract)
  const showPreviews = Boolean(audit.previewMeta)

  // Server strip is the only entitlement; never unlock via client sessionStorage.
  const fixPromptLocked = !showDeterministicFixes
  const demonstratedFlag = sampleFixFlag
  const promptProjection = resolveReportPromptProjection(
    isSample ? 'curated-sample' : fixPromptLocked ? 'live-anonymous' : 'owner'
  )

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
    status: isPartialReport ? 'partial' : triageDegraded ? 'degraded' : 'completed',
    history: scoreHistory,
    capabilities: {
      promptAccess: promptProjection.workspace,
      canReplayTimeline: isRepositorySample || isOwnerAccess,
      canChat: !isSample && isLoggedIn && isOwnerAccess && Boolean(auditId),
      canUseCanvas: !isSample && viewerIsPaid && isOwnerAccess,
      canShare: !isSample && isLoggedIn && isOwnerAccess,
      canRecheck: !isSample && isLoggedIn && isOwnerAccess,
      canGiveFeedback: !isSample && isLoggedIn && isOwnerAccess,
      demonstratedFlagId: demonstratedFlag?.id ?? null,
    },
  })
  const showFeedback = workspace.capabilities.canGiveFeedback
  const showJourney = workspace.capabilities.canReplayTimeline && pages.length > 1
  const showJourneyReview = workspace.capabilities.canReplayTimeline && journeyReviews.length > 0
  const showFlow = workspace.capabilities.canReplayTimeline && Boolean(audit.flowData)
  const showRemember = Boolean(
    workspace.capabilities.canRecheck &&
    auditId &&
    (audit.verifiedLearnings?.length || audit.intentionalNotes?.length || audit.knownRisks?.length)
  )
  const showTimeline =
    workspace.capabilities.canReplayTimeline && (audit.actionTimeline?.length ?? 0) > 0
  const unresolvedFlagCount = workspace.outcome.unresolvedCount
  const polishPassPrompt =
    explorerModel.polishPassPrompt ??
    explorerModel.flags.find((flag) => flag.hasFixPrompt)?.copyFixPrompt ??
    null
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
        pages={pages}
        auditId={auditId}
        demonstratedFlagId={demonstratedFlag?.id}
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

  const playbackSteps = buildPlaybackSteps(audit.actionTimeline ?? [])

  const statusCallouts =
    !isSample && showStatusCallouts ? (
      <div className="space-y-3">
        {aiReviewPending ? (
          <Callout variant="info" title={REPORT_COPY.aiPending.title}>
            {REPORT_COPY.aiPending.body}
          </Callout>
        ) : null}
        {prescriptionFailed ? (
          <Callout variant="warning" title={REPORT_COPY.prescriptionUnavailable.title}>
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
          <Callout variant="warning" title={REPORT_COPY.triageUnavailable.title}>
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
    </>
  )

  const contextSections = (
    <>
      {!isSample && audit.technologyProfile ? (
        <div id="report-stack" className={REPORT_SECTION_SCROLL_MT}>
          <MadeWithProfile profile={audit.technologyProfile} compact />
        </div>
      ) : null}
      {showContract && audit.productContract ? (
        <div id="report-contract" className={REPORT_SECTION_SCROLL_MT}>
          <ProductContractCard
            contract={audit.productContract}
            auditId={auditId}
            canEdit={workspace.capabilities.canRecheck}
          />
        </div>
      ) : null}
      {showRemember && auditId ? (
        <ProductMemoryStrip
          auditId={auditId}
          verifiedLearnings={audit.verifiedLearnings}
          intentionalNotes={audit.intentionalNotes}
          knownRisks={audit.knownRisks}
        />
      ) : null}
      {showJourney || showJourneyReview || showFlow || showTimeline ? (
        <div id="report-funnel" className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-4')}>
          {(audit.actionTimeline?.length ?? 0) > 0 ? (
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>{REPORT_COPY.sectionTitles.timelineCompleted}</SectionTitle>
              <Link
                href={
                  isSample && observationId
                    ? `/samples?observation=${encodeURIComponent(observationId)}&view=timeline&step=1#report-flags`
                    : auditId
                      ? `/report/${encodeURIComponent(auditId)}?view=timeline&step=1#report-flags`
                      : '?view=timeline&step=1#report-flags'
                }
                className="inline-flex items-center gap-1.5 rounded-sm text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                <Play className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {REPORT_COPY.workspace.funnelReplayPath}
              </Link>
            </div>
          ) : null}
          {showJourney ? (
            <JourneyBar
              pages={pages}
              totalFlags={unresolvedFlagCount}
              auditId={auditId}
              primaryUrl={audit.url}
            />
          ) : null}
          {showJourneyReview ? <JourneyReviewTimeline reviews={journeyReviews} /> : null}
          {showFlow && audit.flowData ? <FlowScanTimeline flowData={audit.flowData} /> : null}
        </div>
      ) : null}
      {showPreviews && audit.previewMeta ? (
        <div id="report-previews" className={REPORT_SECTION_SCROLL_MT}>
          <PreviewCards preview={audit.previewMeta} />
        </div>
      ) : null}
      {hasLaunchGates && audit.launchReadiness?.checklist ? (
        <div id="report-launch" className={REPORT_SECTION_SCROLL_MT}>
          <LaunchGates checklist={audit.launchReadiness.checklist} />
        </div>
      ) : null}
      <div id="report-recheck" className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-5')}>
        {!isSample && auditId ? <KeepReportEmail auditId={auditId} /> : null}
        {projectId && workspace.capabilities.canRecheck ? (
          <Button asChild variant="outline">
            <Link href={`/products/${projectId}`}>Return to Product</Link>
          </Button>
        ) : null}
        {showMonitoringHint && workspace.capabilities.canRecheck && projectId ? (
          <div className="space-y-3 rounded-card border border-border/50 bg-muted/15 p-5">
            <p className="text-sm font-semibold">{REPORT_COPY.recheckHint.title}</p>
            <ProductWatchControls
              projectId={projectId}
              canWatch={canWatchProduct}
              canDaily={canDailyWatch}
              initialInterval={watchInterval}
            />
          </div>
        ) : null}
        {isSample ? (
          <div className="space-y-3 rounded-card border border-border/50 bg-muted/15 p-5 text-center sm:p-6">
            <p className="text-sm font-semibold">{REPORT_COPY.sampleCta.title}</p>
            <p className="text-pretty text-sm text-muted-foreground">{REPORT_COPY.sampleCta.body}</p>
            <Button asChild>
              <Link href="/#audit">{HERO.primaryCta}</Link>
            </Button>
          </div>
        ) : null}
        {!isSample && showDeterministicFixes && !showPrescription && isLoggedIn ? (
          <div className="space-y-2 rounded-card border border-border/50 bg-muted/15 p-6 text-center">
            <p className="text-sm font-semibold">
              {aiReviewPending ? UPSELLS.signedInAiPending.headline : UPSELLS.signedInAiDegraded.headline}
            </p>
            <p className="text-sm text-muted-foreground">
              {aiReviewPending ? UPSELLS.signedInAiPending.body : UPSELLS.signedInAiDegraded.body}
            </p>
          </div>
        ) : null}
        {!isSample && !workspace.capabilities.canRecheck ? (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/#audit" className="text-link font-medium underline-offset-2 hover:underline">
              {REPORT_COPY.runYourOwnAudit}
            </Link>
          </p>
        ) : null}
        {!isSample &&
        isLoggedIn &&
        !viewerIsPaid &&
        showPrescription &&
        upgradeMoment &&
        upgradeMoment !== 'free_default' ? (
          <ContextualUpgradeCard
            moment={upgradeMoment}
            isLoggedIn
            currentPlan={viewerPlan}
            auditId={auditId}
          />
        ) : null}
        {workspace.capabilities.canGiveFeedback && auditId ? (
          <ReportFeedback auditId={auditId} />
        ) : null}
        {!isSample ? (
          <AuditPipelineProof
            pipelineVersion={audit.pipelineVersion}
            pipelineLog={audit.pipelineLog}
            startedAt={audit.startedAt}
            completedAt={audit.completedAt}
          />
        ) : null}
      </div>
    </>
  )

  const belowFrame = (
    <>
      {!isSample && unresolvedFlagCount > 0 ? (
        <ReportPolishPass
          flagCount={unresolvedFlagCount}
          prompt={polishPassPrompt}
          locked={fixPromptLocked && !polishPassPrompt}
          generating={Boolean(aiReviewPending && !polishPassPrompt)}
          signUpHref={signUpHref}
          auditId={auditId}
          accessState={fixPromptLocked ? 'anonymous' : 'owner'}
          className="mt-3"
        />
      ) : null}
      <ReportContextDisclosure
        sectionIds={REPORT_CONTEXT_SECTION_IDS}
        className="mt-3"
      >
        {contextSections}
      </ReportContextDisclosure>
      {toolbarActions ?? actions ? (
        <div className="mt-3 flex flex-wrap gap-2">{toolbarActions ?? actions}</div>
      ) : null}
    </>
  )

  const livingReportPanel = (
    <ReportPane
      beforeExplorer={frameExtras}
      explorer={flagsSection}
      afterFrame={belowFrame}
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
            isSample ? 'h-full' : 'h-[calc(100dvh-3.5rem)]'
          )}
        >
          <Suspense fallback={null}>
            <ReportWorkspaceSplitShell
              capabilities={workspace.capabilities}
              timelineGateActionHref={timelineGateActionHref}
              reportHeader={<ReportOutcomeBar model={workspace} />}
              canvasPanel={
                workspace.capabilities.canUseCanvas
                  ? <ReportCanvasPanel auditId={auditId} />
                  : undefined
              }
              leftPanel={
                <WorkspaceChatPanel
                  auditId={auditId}
                  capabilities={workspace.capabilities}
                  gateReason={chatGateReason}
                  agentMessages={agentMessages}
                  reportUrl={audit.url}
                  productName={productName}
                />
              }
              browserUrl={audit.url}
              browserScreenshots={audit.screenshots}
              browserCaptureStatus={captureStatus}
              reportPanel={livingReportPanel}
              steps={playbackSteps}
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
          reportHeader={<ReportOutcomeBar model={workspace} />}
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
          steps={playbackSteps}
          className="h-full min-h-[32rem]"
        />
      </Suspense>
    </div>
  )
}
