import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Suspense, type ReactNode } from 'react'
import { ReportStickyToolbar } from '@/components/audit/ReportStickyToolbar'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { ReportProgressBand } from '@/components/report/ReportWorkspaceChrome'
import { ReportPolishPass } from '@/components/report/ReportPolishPass'
import {
  ReportWorkspaceShell,
  REPORT_SECTION_SCROLL_MT,
} from '@/components/report/ReportWorkspaceShell'
const LiveReportExplorer = dynamic(
  () => import('@/components/audit/LiveReportExplorer').then((m) => m.LiveReportExplorer)
)
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { TriageUnavailableCallout } from '@/components/audit/TriageUnavailableCallout'
import { Card, CardTitle } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import { Play } from 'lucide-react'
import { ReportFixListHeader } from '@/components/report/ReportFixListHeader'
import { ReportVerdictBlockquote } from '@/components/report/ReportVerdictBlockquote'
import { UPSELLS, REPORT_COPY, HERO, AUDIT_ERRORS, ANON_VALUE_STRIP } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { displayVerdict, resolveReportVerdict } from '@/lib/audit/verdict'
import { triageUnavailableBody } from '@/lib/audit/triage-unavailable'
import type {
  AuditScreenshot,
  CapturePresentation,
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
import { ReportSignupCta } from '@/components/audit/ReportSignupCta'
import { MadeWithProfile } from '@/components/audit/MadeWithProfile'
import type { TechnologyProfile } from '@/lib/audit/technology-profile'
import { ReportWorkspaceSplitShell } from '@/components/report/ReportWorkspaceSplitShell'
import { ProductSpineWorkspace } from '@/components/report/ProductSpineWorkspace'
import { buildPlaybackSteps } from '@/lib/audit/playback-steps'
import { WorkspaceChatPanel } from '@/components/report/WorkspaceChatPanel'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

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
    pageType: string | null
    verdict: string | null
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
  viewerIsPaid: boolean
  viewerPlan?: string
  isLoggedIn: boolean
  isViewerOwner?: boolean
  variant?: 'default' | 'sample'
  showMonitoringHint?: boolean
  projectId?: string | null
  canWatchProduct?: boolean
  canDailyWatch?: boolean
  watchInterval?: 'weekly' | 'daily' | null
  atAuditLimit?: boolean
  capturePresentation?: CapturePresentation
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
}

export function AuditReport({
  audit,
  auditId,
  viewerIsPaid,
  viewerPlan = 'FREE',
  isLoggedIn,
  isViewerOwner = true,
  variant = 'default',
  showMonitoringHint = false,
  projectId = null,
  canWatchProduct = false,
  canDailyWatch = false,
  watchInterval = null,
  atAuditLimit = false,
  capturePresentation = { state: 'complete' },
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
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample && isLoggedIn
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}&from=report` : '/sign-up?from=report'
  const hasLaunchGates = (audit.launchReadiness?.checklist?.length ?? 0) > 0
  const showJourney = pages.length > 1
  const showJourneyReview = journeyReviews.length > 0
  const showFlow = Boolean(audit.flowData)
  const showContract = Boolean(audit.productContract)
  const showRemember = Boolean(
    auditId && (audit.verifiedLearnings?.length || audit.intentionalNotes?.length || audit.knownRisks?.length)
  )
  const showTimeline = (audit.actionTimeline?.length ?? 0) > 0
  const showPreviews = Boolean(audit.previewMeta)
  const showStack = Boolean(audit.technologyProfile)

  // Server strip is the only entitlement; never unlock via client sessionStorage.
  const fixPromptLocked = !showDeterministicFixes

  const upgradeMoment =
    !isSample && isLoggedIn && !viewerIsPaid
      ? resolveFreeUserUpgradeMoment({ atAuditLimit })
      : null

  const explorerModel = buildLiveExplorerModel({
    url: audit.url,
    pageType: audit.pageType,
    score: audit.score,
    verdict: audit.verdict,
    flags: audit.flags,
    screenshots: audit.screenshots,
    rubricRows: audit.rubricRows,
    evidenceAnchors: audit.evidenceAnchors,
    previewMeta: audit.previewMeta,
    flagVisualEvidence: audit.flagVisualEvidence,
    productContract: audit.productContract ?? null,
    promptAccess: fixPromptLocked ? (sampleFixFlag ? 'one' : 'none') : 'all',
    demonstratedFlag: sampleFixFlag,
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
    auditId,
    url: audit.url,
    pageType: audit.pageType,
    checkedAt: completedAt,
    status: isPartialReport ? 'partial' : triageDegraded ? 'degraded' : 'completed',
    history: scoreHistory,
    checkedScope: pages.length > 1 ? `${pages.length} pages` : 'the submitted page',
    canShare: !isSample && isLoggedIn && isViewerOwner,
    canRecheck: !isSample && isLoggedIn && isViewerOwner,
    canGiveFeedback: showFeedback,
    promptAccess: fixPromptLocked
      ? sampleFixFlag
        ? 'demonstrated'
        : 'none'
      : 'all',
    demonstratedFlagId: sampleFixFlag?.id,
    recheckOutcome: recheckDiff,
    degradedReason: triageDegraded ? failureCode : null,
  })
  const unresolvedFlagCount = workspace.outcome.unresolvedCount
  const polishPassPrompt =
    explorerModel.polishPassPrompt ??
    explorerModel.flags.find((flag) => flag.hasFixPrompt)?.copyFixPrompt ??
    null
  const userVerdict = resolveReportVerdict(
    displayVerdict(audit.verdict ?? null),
    explorerModel.flags[0]
  )

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
        demonstratedFlagId={sampleFixFlag?.id}
      />
    ) : null

  const flagsNoFlagsSection = (
    <section id="report-flags" className={REPORT_SECTION_SCROLL_MT}>
      <Callout variant="neutral" title={REPORT_COPY.noFlags.title}>
        {REPORT_COPY.noFlags.body}
      </Callout>
    </section>
  )

  const flagsSectionWithHeader =
    unresolvedFlagCount > 0 ? (
      <section id="report-flags" className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-3')}>
        <ReportFixListHeader count={unresolvedFlagCount} />
        {flagsExplorer}
      </section>
    ) : (
      flagsNoFlagsSection
    )

  const showProductSpineWorkspace =
    !isSample && Boolean(auditId) && isViewerOwner && scoreHistory.length > 1;

  return (
    <ReportWorkspaceShell
      workspace={workspace}
      compact={isSample}
      hero={
        <AuditReportHero
          variant={isSample ? 'minimal' : 'default'}
          pageType={audit.pageType}
          url={audit.url}
          screenshots={audit.screenshots}
          capturePresentation={capturePresentation}
          pageSpeedCoverage={audit.pageSpeedCoverage}
          actions={toolbarActions ?? actions}
        />
      }
      beforeProgress={
        !isSample && showStatusCallouts ? (
          <div className="space-y-3 sm:space-y-4">
            {aiReviewPending && (
              <Callout variant="info" title={REPORT_COPY.aiPending.title}>
                {REPORT_COPY.aiPending.body}
              </Callout>
            )}
            {prescriptionFailed && (
              <Callout variant="warning" title={REPORT_COPY.prescriptionUnavailable.title}>
                {AUDIT_ERRORS.partialAiReview}
              </Callout>
            )}
            {triageDegraded && auditId ? (
              <TriageUnavailableCallout
                auditId={auditId}
                failureCode={failureCode}
                isLoggedIn={isLoggedIn}
                canRetry={isLoggedIn && isViewerOwner}
                signUpHref={signUpHref}
              />
            ) : null}
            {triageDegraded && !auditId ? (
              <Callout variant="warning" title={REPORT_COPY.triageUnavailable.title}>
                {triageUnavailableBody(failureCode, isLoggedIn)}
              </Callout>
            ) : null}
            {isPartialReport && !triageDegraded && (
              <Callout variant="warning" title={REPORT_COPY.partialReport.title}>
                {REPORT_COPY.partialReport.body}
              </Callout>
            )}
            {(audit.failedModules?.length ?? 0) > 0 && (
              <Callout variant="warning" title={REPORT_COPY.failedChecks.title}>
                {REPORT_COPY.failedChecks.body(audit.failedModules ?? [])}
              </Callout>
            )}
          </div>
        ) : null
      }
      afterProgress={
        !isSample && recheckDiff ? (
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
        ) : null
      }
      progressBand={
        showProductSpineWorkspace ? null : <ReportProgressBand model={workspace} />
      }
      stickyNav={
        !isSample ? (
          <div className="space-y-4">
            {userVerdict ? (
              <ReportVerdictBlockquote verdict={userVerdict} />
            ) : null}
            <ReportStickyToolbar
              showPolish={unresolvedFlagCount > 0}
              showContract={showContract}
              showRemember={showRemember}
              showJourney={showJourney || showJourneyReview}
              showFlow={showFlow}
              showTimeline={showTimeline}
              showPreviews={showPreviews}
              showLaunch={hasLaunchGates}
              showStack={showStack}
              showRecheckSection={isLoggedIn && isViewerOwner}
              siteUrl={audit.url}
              auditId={auditId}
            />
          </div>
        ) : null
      }
      polishPass={
        !isSample && unresolvedFlagCount > 0 ? (
          <ReportPolishPass
            flagCount={unresolvedFlagCount}
            prompt={polishPassPrompt}
            locked={fixPromptLocked && !polishPassPrompt}
            generating={aiReviewPending && !polishPassPrompt}
            signUpHref={signUpHref}
            auditId={auditId}
            accessState={fixPromptLocked ? 'anonymous' : 'owner'}
          />
        ) : null
      }
      flagsSection={
        !isSample && auditId ? (
          showProductSpineWorkspace ? (
            <ProductSpineWorkspace
              reportId={auditId}
              history={scoreHistory}
              model={workspace}
              url={audit.url}
              screenshots={audit.screenshots ?? []}
              steps={buildPlaybackSteps(audit.actionTimeline ?? [])}
              activityEvents={audit.actionTimeline ?? []}
              canChat={isViewerOwner}
              reportPanel={flagsSectionWithHeader}
            />
          ) : (
            <Suspense fallback={null}>
              <ReportWorkspaceSplitShell
                showChatColumn={isViewerOwner}
                leftPanel={<WorkspaceChatPanel auditId={auditId} canChat={isViewerOwner} />}
                activityEvents={audit.actionTimeline ?? []}
                browserUrl={audit.url}
                browserScreenshots={audit.screenshots}
                reportPanel={flagsSectionWithHeader}
                steps={buildPlaybackSteps(audit.actionTimeline ?? [])}
              />
            </Suspense>
          )
        ) : (
          flagsSectionWithHeader
        )
      }
      contextSections={
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
                canEdit={isLoggedIn && isViewerOwner}
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

          {(showJourney || showJourneyReview || showFlow || showTimeline) ? (
            <div id="report-funnel" className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-4')}>
              {(audit.actionTimeline?.length ?? 0) > 0 ? (
                <div className="flex items-center justify-between gap-3">
                  <SectionTitle>{REPORT_COPY.sectionTitles.timelineCompleted}</SectionTitle>
                  <Link
                    href={`?step=1#report-flags`}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring rounded-sm"
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

          {showPreviews && audit.previewMeta ? <PreviewCards preview={audit.previewMeta} /> : null}

          {hasLaunchGates && audit.launchReadiness?.checklist ? (
            <LaunchGates checklist={audit.launchReadiness.checklist} />
          ) : null}

          {!isSample && fixPromptLocked && (
            <Card className="space-y-3 p-5 text-center sm:p-6">
              <div className="space-y-1">
                <p className="text-sm font-medium">{ANON_VALUE_STRIP.headline(unresolvedFlagCount)}</p>
                <p className="text-xs text-muted-foreground text-pretty">{ANON_VALUE_STRIP.body}</p>
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <ReportSignupCta href={signUpHref} from="value_strip" size="sm">
                  {ANON_VALUE_STRIP.primaryCta}
                </ReportSignupCta>
                <Button asChild variant="ghost" size="sm">
                  <Link href={auditId ? `/sign-in?next=/report/${auditId}&from=report` : '/sign-in?from=report'}>
                    {ANON_VALUE_STRIP.secondaryCta}
                  </Link>
                </Button>
              </div>
            </Card>
          )}
        </>
      }
      footerSections={
        <div id="report-recheck" className={cn(REPORT_SECTION_SCROLL_MT, 'space-y-6 sm:space-y-8')}>
          {showMonitoringHint && isLoggedIn && isViewerOwner && (
            <Card className="space-y-3 p-5">
              <CardTitle className="text-sm">{REPORT_COPY.recheckHint.title}</CardTitle>
              {projectId ? (
                <ProductWatchControls
                  projectId={projectId}
                  canWatch={canWatchProduct}
                  canDaily={canDailyWatch}
                  initialInterval={watchInterval}
                />
              ) : (
                <p className="text-sm text-muted-foreground text-pretty">
                  {REPORT_COPY.recheckHint.bodyPrefix}{' '}
                  <strong>{REPORT_COPY.recheck.label}</strong> {REPORT_COPY.recheckHint.bodySuffix}
                </p>
              )}
            </Card>
          )}

          {isSample && (
            <Card className="space-y-3 p-5 text-center sm:p-6">
              <CardTitle>{REPORT_COPY.sampleCta.title}</CardTitle>
              <p className="text-sm text-muted-foreground text-pretty">{REPORT_COPY.sampleCta.body}</p>
              <Button asChild>
                <Link href="/#audit">{HERO.primaryCta}</Link>
              </Button>
            </Card>
          )}

          {!isSample && showDeterministicFixes && !showPrescription && isLoggedIn && (
            <Card className="space-y-2 p-6 text-center">
              <CardTitle>
                {aiReviewPending ? UPSELLS.signedInAiPending.headline : UPSELLS.signedInAiDegraded.headline}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {aiReviewPending ? UPSELLS.signedInAiPending.body : UPSELLS.signedInAiDegraded.body}
              </p>
            </Card>
          )}

          {!isSample && !isViewerOwner && (
            <p className="text-center text-sm text-muted-foreground">
              <Link href="/#audit" className="text-link font-medium underline-offset-2 hover:underline">
                {REPORT_COPY.runYourOwnAudit}
              </Link>
            </p>
          )}

          {!isSample &&
            isLoggedIn &&
            !viewerIsPaid &&
            showPrescription &&
            upgradeMoment &&
            upgradeMoment !== 'free_default' && (
            <ContextualUpgradeCard
              moment={upgradeMoment}
              isLoggedIn
              currentPlan={viewerPlan}
              auditId={auditId}
            />
          )}

          {!isSample && auditId && <ReportFeedback auditId={auditId} />}

          {!isSample && (
            <AuditPipelineProof
              pipelineVersion={audit.pipelineVersion}
              pipelineLog={audit.pipelineLog}
              startedAt={audit.startedAt}
              completedAt={audit.completedAt}
            />
          )}
        </div>
      }
    />
  )
}
