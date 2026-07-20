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
  rankFlagsByPriority,
  countFixPrompts,
  buildPlanModePrompt,
  resolveFixPrompt,
} from '@/lib/audit/priority-flags'
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
  }
  auditId?: string
  viewerIsPaid: boolean
  viewerPlan?: string
  isLoggedIn: boolean
  isViewerOwner?: boolean
  variant?: 'default' | 'sample'
  showMonitoringHint?: boolean
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
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample && isLoggedIn
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}&from=report` : '/sign-up?from=report'
  const hasFixPrompts = auditHasFixPrompts(audit.flags)
  const hasLaunchGates = (audit.launchReadiness?.checklist?.length ?? 0) > 0
  const userVerdict = displayVerdict(audit.verdict ?? null)
  const showJourney = !isSample && pages.length > 1
  const showJourneyReview = !isSample && journeyReviews.length > 0
  const showFlow = !isSample && Boolean(audit.flowData)
  const showContract = !isSample && Boolean(audit.productContract)
  const showTimeline = !isSample && (audit.actionTimeline?.length ?? 0) > 0
  const showPreviews = !isSample && Boolean(audit.previewMeta)

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
        })
      : null

  const isPartialReport = audit.reportCompleteness === 'PARTIAL'
  const showStatusCallouts =
    !isSample &&
    (aiReviewPending || triageDegraded || prescriptionFailed || isPartialReport)

  const showPriorities = !isSample && Boolean(explorerModel) && hasFixPrompts && showPrescription

  return (
    <Container
      variant="report"
      className={isSample ? 'space-y-4 pb-4 sm:pb-6' : 'space-y-6 py-6 sm:space-y-8 sm:py-8'}
    >
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
                <Callout variant="warning" title="Fix prompts unavailable">
                  {AUDIT_ERRORS.partialAiReview}
                </Callout>
              )}

              {triageDegraded && (
                <Callout variant="warning" title="AI summary unavailable">
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
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </Card>
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

      {!isSample && explorerModel && hasFixPrompts && showPrescription && (
        <section id="report-priorities" className="scroll-mt-[var(--header-offset)] space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <SectionTitle>{REPORT_COPY.sectionTitles.topPriorities}</SectionTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {REPORT_COPY.sectionTitles.topPrioritiesHint}
              </p>
            </div>
            {(() => {
              const total = countFixPrompts(audit.flags)
              if (total === 0) return null
              return (
                <PromptCopyButton
                  prompt={buildPlanModePrompt(audit.flags, { url: audit.url })}
                  label={`Copy fix plan (${total})`}
                  compact
                  kind="plan"
                  auditId={auditId}
                />
              )
            })()}
          </div>
          <div className="grid gap-3">
            {rankFlagsByPriority(audit.flags, audit.rubricRows, 3).map(({ flag, rubricName }) => {
              const prompt = resolveFixPrompt(flag)
              if (!prompt) return null
              const toolPrompts = {
                universal: flag.agentPrompt,
                cursor: flag.cursorPrompt,
                claude: flag.claudePrompt,
                windsurf: flag.windsurfPrompt,
                lovable: flag.lovablePrompt,
                bolt: flag.boltPrompt,
              }
              const impact = impactTagLabel(flag.impactTag)
              return (
                <Card key={flag.id} className="p-4 sm:p-5">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <SeveritySignal severity={flag.severity} />
                    <span className="meta-label text-muted-foreground">
                      {rubricLabel(rubricName)}
                    </span>
                    {impact ? (
                      <span className="text-2xs text-muted-foreground">{impact}</span>
                    ) : null}
                  </div>
                  <p className="mb-3 text-sm font-medium leading-snug text-pretty">
                    {flag.problem}
                  </p>
                  {flag.evidence?.trim() ? (
                    <p className="mb-3 text-xs leading-snug text-muted-foreground text-pretty">
                      {flag.evidence.trim().slice(0, 180)}
                      {flag.evidence.trim().length > 180 ? '…' : ''}
                    </p>
                  ) : null}
                  <FixPromptBlock
                    prompt={prompt}
                    toolPrompts={toolPrompts}
                    showToolSelector
                    rows={2}
                    clamp
                    variant="compact"
                    nested
                  />
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
          <SectionTitle>How we checked</SectionTitle>
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
          <Card className="space-y-2 p-5">
            <CardTitle className="text-sm">{REPORT_COPY.recheckHint.title}</CardTitle>
            <p className="text-sm text-muted-foreground text-pretty">
              {REPORT_COPY.recheckHint.bodyPrefix}{' '}
              <strong>{REPORT_COPY.recheck.label}</strong> {REPORT_COPY.recheckHint.bodySuffix}
            </p>
          </Card>
        )}

        {isSample && (
          <Card className="space-y-3 p-5 text-center sm:p-6">
            <CardTitle>{REPORT_COPY.sampleCta.title}</CardTitle>
            <p className="text-sm text-muted-foreground text-pretty">{REPORT_COPY.sampleCta.body}</p>
            <Button asChild>
              <Link href="/">{HERO.primaryCta}</Link>
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
