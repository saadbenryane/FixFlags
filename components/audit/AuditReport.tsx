import Link from 'next/link'
import dynamic from 'next/dynamic'
import type { ReactNode } from 'react'
import { ReportStickyToolbar } from '@/components/audit/ReportStickyToolbar'
import { RubricsPanel } from '@/components/audit/RubricsPanel'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'

const LiveReportExplorer = dynamic(
  () => import('@/components/audit/LiveReportExplorer').then((m) => m.LiveReportExplorer)
)
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionTitle } from '@/components/ui/typography'
import { UPSELLS, REPORT_COPY, HERO, AUDIT_ERRORS, ANON_CLAIM_GUIDE } from '@/lib/marketing/copy'
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
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { PromptCopyButton } from '@/components/audit/PromptCopyButton'
import { LaunchGates } from '@/components/audit/LaunchGates'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import { PreviewCards } from '@/components/audit/PreviewCards'
import { FlowScanTimeline } from '@/components/audit/FlowScanTimeline'
import { JourneyBar, type JourneyPage } from '@/components/audit/JourneyBar'
import {
  RecheckDiffStrip,
  type RecheckDiffSummary,
} from '@/components/audit/RecheckDiffStrip'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import type { FlowData } from '@/lib/audit/flow-data'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { buildLiveExplorerModel } from '@/lib/report/explorer-model'
import { rubricLabel, severityLabel } from '@/lib/utils'

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
    pageJob: string | null
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
    evidenceCoverage?: unknown
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
  recheckDiff?: RecheckDiffSummary | null
  compareHref?: string | null
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
  recheckDiff = null,
  compareHref = null,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}&from=report` : '/sign-up?from=report'
  const fixPromptLocked = !showDeterministicFixes
  const aiPrescriptionLocked = !showPrescription
  const hasFixPrompts = auditHasFixPrompts(audit.flags)
  const hasLaunchGates = (audit.launchReadiness?.checklist?.length ?? 0) > 0
  const userVerdict = displayVerdict(audit.verdict ?? null)

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
        })
      : null

  const showOverview =
    !isSample &&
    (aiReviewPending ||
      triageDegraded ||
      prescriptionFailed ||
      audit.reportCompleteness !== 'FULL' ||
      hasLaunchGates ||
      Boolean(audit.previewMeta) ||
      Boolean(audit.flowData) ||
      !isViewerOwner)

  return (
    <Container
      variant="report"
      className={isSample ? 'space-y-4 pb-4 sm:pb-6' : 'space-y-6 py-6 sm:space-y-8 sm:py-8'}
    >
      <AuditReportHero
        variant={isSample ? 'minimal' : 'default'}
        score={audit.score}
        pageType={audit.pageType}
        verdict={audit.verdict}
        url={audit.url}
        shareStatus={audit.shareStatus}
        rubrics={audit.rubrics}
        totalFlags={audit.flags.length}
        screenshotLimited={screenshotLimited}
        screenshotPartial={screenshotPartial}
        pageSpeedPartial={audit.pageSpeedErrors?.pageSpeedPartial}
      />

      {!isSample && pages.length > 1 && (
        <JourneyBar
          pages={pages}
          totalFlags={audit.flags.length}
          auditId={auditId}
          primaryUrl={audit.url}
        />
      )}

      {!isSample && (
        <>
          <ReportStickyToolbar
            showOverview={showOverview}
            showPreviews={Boolean(audit.previewMeta)}
            showFlow={Boolean(audit.flowData)}
            showLaunchGates={hasLaunchGates}
            showJourney={pages.length > 1}
            showRecheckSection={!(isLoggedIn && isViewerOwner)}
            siteUrl={audit.url}
            score={audit.score}
            actions={toolbarActions ?? actions}
          />

          {userVerdict ? (
            <blockquote className="border-l-2 border-brand pl-4 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:text-lg">
              {userVerdict}
            </blockquote>
          ) : null}

          {recheckDiff ? (
            <RecheckDiffStrip summary={recheckDiff} compareHref={compareHref} />
          ) : null}
        </>
      )}

      {!isSample && explorerModel && hasFixPrompts && showPrescription && (
        <section id="report-priorities" className="scroll-mt-[var(--header-offset)] space-y-3">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle>{REPORT_COPY.sectionTitles.topPriorities}</SectionTitle>
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
              return (
                <Card key={flag.id} className="p-4 sm:p-5">
                  <div className="mb-3 flex items-center gap-2">
                    <Badge
                      variant={flag.severity === 'CRITICAL' ? 'destructive' : 'secondary'}
                      size="sm"
                    >
                      {severityLabel(flag.severity)}
                    </Badge>
                    <span className="text-[10px] font-mono uppercase tracking-label text-muted-foreground">
                      {rubricLabel(rubricName)}
                    </span>
                  </div>
                  <p className="mb-3 text-sm font-medium leading-snug text-pretty">
                    {flag.problem}
                  </p>
                  <FixPromptBlock prompt={prompt} rows={2} clamp variant="compact" nested />
                </Card>
              )
            })}
          </div>
        </section>
      )}

      {explorerModel ? (
        <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
          <LiveReportExplorer
            model={explorerModel}
            showFeedback={showFeedback}
            aiLocked={fixPromptLocked}
            aiEnhancementPending={!aiPrescriptionLocked ? false : isLoggedIn && aiReviewPending}
            signUpHref={signUpHref}
            hasFixPrompts={showDeterministicFixes && hasFixPrompts}
            defaultSeverityFilter={
              audit.flags.some((f) => f.severity === 'CRITICAL') ? 'CRITICAL' : 'ALL'
            }
            pages={pages}
          />
        </section>
      ) : (
        <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
          <Callout variant="neutral" title={REPORT_COPY.noFlags.title}>
            {REPORT_COPY.noFlags.body}
          </Callout>
        </section>
      )}

      {!isSample && fixPromptLocked && (
        <Card className="space-y-4 p-6 text-center sm:p-8">
          <div className="space-y-2">
            <CardTitle>{ANON_CLAIM_GUIDE.headline}</CardTitle>
            <p className="text-sm text-muted-foreground text-pretty">{ANON_CLAIM_GUIDE.body}</p>
          </div>
          <ol className="mx-auto max-w-md space-y-2 text-left text-sm text-foreground">
            {ANON_CLAIM_GUIDE.steps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {index + 1}.
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild>
              <Link href={signUpHref}>{ANON_CLAIM_GUIDE.primaryCta}</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/pricing">{UPSELLS.anon.secondaryCta}</Link>
            </Button>
          </div>
        </Card>
      )}

      {showOverview && (
        <div id="report-overview" className="scroll-mt-[var(--header-offset)] space-y-4 sm:space-y-5">
          {!isViewerOwner && <ThirdPartyAuditDisclaimer variant="compact" />}

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

          {audit.reportCompleteness !== 'FULL' && !triageDegraded && (
            <Callout variant="warning" title={REPORT_COPY.partialReport.title}>
              {REPORT_COPY.partialReport.body}
            </Callout>
          )}

          {hasLaunchGates && audit.launchReadiness?.checklist && (
            <LaunchGates checklist={audit.launchReadiness.checklist} />
          )}

          {audit.previewMeta && (
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-label text-muted-foreground">Reach</p>
              <PreviewCards preview={audit.previewMeta} />
            </div>
          )}

          {audit.flowData && (
            <div className="space-y-2">
              <p className="text-xs font-mono uppercase tracking-label text-muted-foreground">Experience</p>
              <FlowScanTimeline flowData={audit.flowData} />
            </div>
          )}
        </div>
      )}

      {!isSample && (
        <section id="report-rubrics" className="scroll-mt-[var(--header-offset)] space-y-3">
          <SectionTitle>{REPORT_COPY.sectionTitles.summaryByRubric}</SectionTitle>
          <RubricsPanel
            rubrics={audit.rubrics}
            rubricRows={audit.rubricRows}
            showFeedback={showFeedback}
            aiLocked={fixPromptLocked}
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

        {!isSample && isLoggedIn && !viewerIsPaid && showPrescription && (
          <ContextualUpgradeCard
            moment={upgradeMoment && upgradeMoment !== 'free_default' ? upgradeMoment : 'report_completed'}
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
