import type { Route } from 'next'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { type ReactNode } from 'react'
import { ReportStickyToolbar } from '@/components/audit/ReportStickyToolbar'
import { RubricBar } from '@/components/audit/RubricBar'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { ShareStatusBanner } from '@/components/audit/ShareStatusBanner'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'

const LiveReportExplorer = dynamic(
  () => import('@/components/audit/LiveReportExplorer').then((m) => m.LiveReportExplorer)
)
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionTitle } from '@/components/ui/typography'
import { UPSELLS, REPORT_COPY, HERO, AUDIT_ERRORS, ANON_VALUE_STRIP } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import { displayVerdict } from '@/lib/audit/verdict'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { AuditPipelineProof } from '@/components/audit/AuditPipelineProof'
import { ReportFeedback } from '@/components/report/ReportFeedback'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import {
  auditHasFixPrompts,
} from '@/lib/audit/priority-flags'
import { buildFinishPlan, type FinishPlan } from '@/lib/audit/finish-plan'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
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
import { SampleFixCard } from '@/components/report/SampleFixCard'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { impactTagLabel, rubricLabel } from '@/lib/utils'
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
import { ActionTimeline } from '@/components/audit/ActionTimeline'
import { ReportSignupCta } from '@/components/audit/ReportSignupCta'

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
    shareStatus: string
    launchReadiness?: LaunchReadinessData | null
    reportCompleteness?: 'FULL' | 'PARTIAL' | 'UNKNOWN'
    pipelineVersion?: string | null
    pipelineLog?: PipelineLogEvent[] | null
    startedAt?: string | Date | null
    completedAt?: string | Date | null
    parentId?: string | null
    pageSpeedErrors?: {
      desktopError?: string
      mobileError?: string
      pageSpeedPartial?: boolean
    }
    previewMeta?: PreviewMeta | null
    flowData?: FlowData | null
    evidenceAnchors?: EvidenceAnchorMap
    flagVisualEvidence?: import('@/lib/audit/persist-visual-evidence').FlagVisualEvidenceMap
    actionTimeline?: import('@/lib/audit/action-timeline').ActionTimelineEvent[]
    productContract?: import('@/lib/audit/product-contract').ProductContract | null
    verifiedLearnings?: import('@/lib/audit/product-intelligence').VerifiedLearning[]
    intentionalNotes?: string[]
    knownRisks?: string[]
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
  screenshotLimited?: boolean
  screenshotPartial?: boolean
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
  compareHref?: string | null
  sampleFixFlag?: RankableFlag | null
  backToPlanHref?: string
  showFinishPlan?: boolean
  finishPlan?: FinishPlan
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
  screenshotLimited = false,
  screenshotPartial = false,
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
  compareHref = null,
  sampleFixFlag = null,
  backToPlanHref,
  showFinishPlan = true,
  finishPlan: finishPlanProp,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample && isLoggedIn
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}&from=report` : '/sign-up?from=report'
  const hasFixPrompts = auditHasFixPrompts(audit.flags)
  const hasLaunchGates = (audit.launchReadiness?.checklist?.length ?? 0) > 0
  const userVerdict = displayVerdict(audit.verdict ?? null)
  const showJourney = pages.length > 1
  const showJourneyReview = journeyReviews.length > 0
  const showFlow = Boolean(audit.flowData)
  const showContract = Boolean(audit.productContract)
  const showRemember = Boolean(
    auditId && (audit.verifiedLearnings?.length || audit.intentionalNotes?.length || audit.knownRisks?.length)
  )
  const showTimeline = (audit.actionTimeline?.length ?? 0) > 0
  const showPreviews = Boolean(audit.previewMeta)

  // Server strip is the only entitlement; never unlock via client sessionStorage.
  const fixPromptLocked = !showDeterministicFixes

  const upgradeMoment =
    !isSample && isLoggedIn && !viewerIsPaid
      ? resolveFreeUserUpgradeMoment({ atAuditLimit })
      : null

  const explorerModel =
    audit.flags.length > 0
      ? buildLiveExplorerModel({
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
        })
      : null

  const isPartialReport = audit.reportCompleteness === 'PARTIAL'
  const showStatusCallouts =
    !isSample &&
    (aiReviewPending || triageDegraded || prescriptionFailed || isPartialReport)

  const showPriorities =
    showFinishPlan && !isSample && Boolean(explorerModel) && (hasFixPrompts || fixPromptLocked)
  const finishPlan =
    finishPlanProp ??
    buildFinishPlan({
      flags: audit.flags,
      rubricRows: audit.rubricRows,
      url: audit.url,
      contract: audit.productContract ?? null,
      promptAccess: showPrescription ? 'all' : 'none',
    })

  return (
    <Container
      variant="report"
      className={isSample ? 'space-y-4 pb-4 sm:pb-6' : 'space-y-6 py-6 sm:space-y-8 sm:py-8'}
    >
      {backToPlanHref ? (
        <Button asChild variant="ghost" className="min-h-11 w-fit">
          <Link href={backToPlanHref as Route}>{REPORT_COPY.focused.backToPlan}</Link>
        </Button>
      ) : null}
      <AuditReportHero
        variant={isSample ? 'minimal' : 'default'}
        score={audit.score}
        pageType={audit.pageType}
        url={audit.url}
        screenshots={audit.screenshots}
        screenshotLimited={screenshotLimited}
        screenshotPartial={screenshotPartial}
        pageSpeedPartial={audit.pageSpeedErrors?.pageSpeedPartial}
        startedAt={audit.startedAt}
        completedAt={audit.completedAt}
      />

      {!isSample && (
        <ShareStatusBanner shareStatus={audit.shareStatus} rubrics={audit.rubrics} />
      )}

      {!isSample && (
        <RubricBar rubrics={audit.rubrics} rubricRows={audit.rubricRows} />
      )}

      {!isSample && (
        <>
          <ReportStickyToolbar
            showContract={showContract}
            showRemember={showRemember}
            showPriorities={showPriorities}
            showJourney={showJourney || showJourneyReview}
            showFlow={showFlow}
            showTimeline={showTimeline}
            showPreviews={showPreviews}
            showLaunch={hasLaunchGates}
            showRecheckSection={isLoggedIn && isViewerOwner}
            hasRecheckDiff={Boolean(recheckDiff)}
            siteUrl={audit.url}
            score={audit.score}
            actions={toolbarActions ?? actions}
          />

          {userVerdict ? (
            <blockquote className="border-l-2 border-brand pl-4 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:text-lg">
              {userVerdict}
            </blockquote>
          ) : null}

          {showStatusCallouts ? (
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

              {triageDegraded && (
                <Callout variant="warning" title={REPORT_COPY.triageUnavailable.title}>
                  {failureCode === 'AI_PROVIDER_NOT_CONFIGURED'
                    ? AUDIT_ERRORS.triageProviderNotConfigured
                    : (audit.verdict ?? AUDIT_ERRORS.partialReport)}
                </Callout>
              )}

              {isPartialReport && !triageDegraded && (
                <Callout variant="warning" title={REPORT_COPY.partialReport.title}>
                  {REPORT_COPY.partialReport.body}
                </Callout>
              )}
            </div>
          ) : null}

          {recheckDiff ? (
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
      )}

      {showContract && audit.productContract ? (
        <div id="report-contract" className="scroll-mt-[var(--header-offset)]">
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

      {showFinishPlan && !isSample && explorerModel && (hasFixPrompts || fixPromptLocked) && (
        <section id="report-finish-plan" className="scroll-mt-[var(--header-offset)] space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle>{REPORT_COPY.sectionTitles.topPriorities}</SectionTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {fixPromptLocked
                  ? REPORT_COPY.sectionTitles.topPrioritiesLocked
                  : aiReviewPending
                    ? REPORT_COPY.sectionTitles.topPrioritiesGenerating
                    : REPORT_COPY.sectionTitles.topPrioritiesHint}
              </p>
            </div>
            {finishPlan.copyPrompt ? (
              <PromptCopyButton
                prompt={finishPlan.copyPrompt}
                label={REPORT_COPY.sectionTitles.copyFixPlan(finishPlan.visiblePromptCount)}
                compact
                kind="plan"
                auditId={auditId}
              />
            ) : null}
          </div>
          <div className="grid gap-3">
            {finishPlan.items.map((item) => {
              const impact = impactTagLabel(item.impactTag)
              return (
                <Card key={item.id} className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <SeveritySignal severity={item.severity} />
                    <span className="meta-label text-muted-foreground">
                      {rubricLabel(item.rubricName)}
                    </span>
                    {impact ? (
                      <span className="text-2xs text-muted-foreground">{impact}</span>
                    ) : null}
                  </div>
                  <p className="mb-3 text-sm font-medium leading-snug text-pretty">
                    {item.problem}
                  </p>
                  {item.evidence.trim() ? (
                    <p className="mb-3 text-xs leading-snug text-muted-foreground text-pretty">
                      {item.evidence.trim().slice(0, 180)}
                      {item.evidence.trim().length > 180 ? '…' : ''}
                    </p>
                  ) : null}
                  {item.prompt ? (
                    <FixPromptBlock
                      prompt={item.prompt}
                      toolPrompts={item.toolPrompts ?? undefined}
                      showToolSelector
                      rows={2}
                      clamp
                      variant="compact"
                      nested
                    />
                  ) : null}
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {(showJourney || showJourneyReview) ? (
        <div id="report-journey" className="scroll-mt-[var(--header-offset)] space-y-4">
          {showJourney ? (
            <JourneyBar
              pages={pages}
              totalFlags={audit.flags.length}
              auditId={auditId}
              primaryUrl={audit.url}
            />
          ) : null}
          {showJourneyReview ? <JourneyReviewTimeline reviews={journeyReviews} /> : null}
        </div>
      ) : null}

      {showFlow && audit.flowData ? <FlowScanTimeline flowData={audit.flowData} /> : null}

      {showTimeline && (audit.actionTimeline?.length ?? 0) > 0 ? (
        <section
          id="report-timeline"
          className="scroll-mt-[var(--header-offset)] rounded-card bg-card/40 px-5 py-4 shadow-card glass-surface"
        >
          <SectionTitle>{REPORT_COPY.sectionTitles.timelineCompleted}</SectionTitle>
          <ActionTimeline events={audit.actionTimeline ?? []} className="mt-3" />
        </section>
      ) : null}

      {explorerModel ? (
        <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
          <LiveReportExplorer
            model={explorerModel}
            showFeedback={showFeedback}
            aiLocked={fixPromptLocked}
            aiEnhancementPending={isLoggedIn && aiReviewPending}
            signUpHref={signUpHref}
            pages={pages}
            auditId={auditId}
          />
        </section>
      ) : (
        <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
          <Callout variant="neutral" title={REPORT_COPY.noFlags.title}>
            {REPORT_COPY.noFlags.body}
          </Callout>
        </section>
      )}

      {showPreviews && audit.previewMeta ? <PreviewCards preview={audit.previewMeta} /> : null}

      {hasLaunchGates && audit.launchReadiness?.checklist ? (
        <LaunchGates checklist={audit.launchReadiness.checklist} />
      ) : null}

      {!isSample && fixPromptLocked && (
        <Card className="space-y-3 p-5 text-center sm:p-6">
          <div className="space-y-1">
            <p className="text-sm font-medium">{ANON_VALUE_STRIP.headline(audit.flags.length)}</p>
            <p className="text-xs text-muted-foreground text-pretty">{ANON_VALUE_STRIP.body}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <ReportSignupCta href={signUpHref} from="value_strip" size="sm">
              {ANON_VALUE_STRIP.primaryCta}
            </ReportSignupCta>
            <Button asChild variant="ghost" size="sm">
              <Link href="/sign-in">{ANON_VALUE_STRIP.secondaryCta}</Link>
            </Button>
          </div>
        </Card>
      )}

      {!isSample && fixPromptLocked && sampleFixFlag && (
        <section id="report-sample-fix" className="scroll-mt-[var(--header-offset)]">
          <SampleFixCard
            flag={sampleFixFlag}
            totalFlags={audit.flags.length}
            signUpHref={signUpHref}
          />
        </section>
      )}

      <div id="report-monitoring" className="scroll-mt-[var(--header-offset)] space-y-6 sm:space-y-8">
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
    </Container>
  )
}
