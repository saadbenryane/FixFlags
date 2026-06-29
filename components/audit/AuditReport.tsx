import Link from 'next/link'
import { ReportMiniNav } from '@/components/audit/ReportMiniNav'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'
import { RubricCard } from '@/components/audit/RubricCard'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { LockedContentTeaser } from '@/components/audit/LockedContentTeaser'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionTitle } from '@/components/ui/typography'
import { UPSELLS, REPORT_COPY, HERO, OUTPUT_LABELS } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import {
  auditHasFixPrompts,
  getTopFixPromptFromFlags,
} from '@/lib/audit/priority-flags'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LaunchGates } from '@/components/audit/LaunchGates'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import { PreviewCards } from '@/components/audit/PreviewCards'
import { FlowScanTimeline } from '@/components/audit/FlowScanTimeline'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import type { FlowData } from '@/lib/audit/flow-data'
import type { EvidenceAnchorMap } from '@/lib/marketing/resolve-evidence-anchors'
import { buildLiveExplorerModel } from '@/lib/report/explorer-model'

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
  showRecheckHint?: boolean
  atAuditLimit?: boolean
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  showAiContent?: boolean
  aiReviewPending?: boolean
}

export function AuditReport({
  audit,
  auditId,
  viewerIsPaid,
  viewerPlan = 'FREE',
  isLoggedIn,
  isViewerOwner = true,
  variant = 'default',
  showRecheckHint = false,
  atAuditLimit = false,
  showAiContent = true,
  aiReviewPending = false,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  screenshotLimited,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  screenshotPartial,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}&from=report` : '/sign-up?from=report'
  const aiLocked = !showAiContent
  const hasFixPrompts = auditHasFixPrompts(audit.flags)
  const topFixPrompt = getTopFixPromptFromFlags(audit.flags)
  const hasLaunchGates =
    !aiLocked && (audit.launchReadiness?.checklist?.length ?? 0) > 0

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
      hasLaunchGates ||
      Boolean(audit.previewMeta) ||
      Boolean(audit.flowData) ||
      !isViewerOwner)

  return (
    <>
      {!isSample && (
        <ReportMiniNav
          showPreviews={Boolean(audit.previewMeta)}
          showFlow={Boolean(audit.flowData)}
          showFix={Boolean(topFixPrompt && !explorerModel)}
          showLaunchGates={hasLaunchGates}
          siteUrl={audit.url}
        />
      )}
      <Container
        variant="report"
        className={isSample ? 'space-y-4 pb-4 sm:pb-6' : 'space-y-6 pt-4 sm:space-y-8 sm:pt-6 pb-4 sm:pb-6'}
      >
      <AuditReportHero
        variant={isSample ? 'minimal' : 'default'}
        score={audit.score}
        pageType={audit.pageType}
        verdict={audit.verdict}
        url={audit.url}
        shareStatus={audit.shareStatus}
        rubrics={audit.rubrics}
        screenshots={audit.screenshots}
        durationMs={
          audit.startedAt && audit.completedAt
            ? new Date(audit.completedAt).getTime() - new Date(audit.startedAt).getTime()
            : null
        }
        startedAt={audit.startedAt}
        completedAt={audit.completedAt}
      />

      {explorerModel ? (
        <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
          <div className="overflow-hidden rounded-card glass-surface shadow-card">
            <LiveReportExplorer
              model={explorerModel}
              showFeedback={showFeedback}
              aiLocked={aiLocked}
              signUpHref={signUpHref}
              hasFixPrompts={showAiContent && hasFixPrompts}
            />
          </div>
        </section>
      ) : (
        <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
          <Callout variant="neutral" title="No flags found">
            This scan did not surface any issues. Nice work.
          </Callout>
        </section>
      )}

      {showOverview && (
        <div id="report-overview" className="scroll-mt-[var(--header-offset)] space-y-4 sm:space-y-5">
          {!isViewerOwner && <ThirdPartyAuditDisclaimer variant="compact" />}

          {aiReviewPending && (
            <Callout variant="info" title="Generating AI review">
              Unlocking fix prompts and rubric analysis. This usually takes under a minute.
            </Callout>
          )}

          {hasLaunchGates && audit.launchReadiness?.checklist && (
            <LaunchGates checklist={audit.launchReadiness.checklist} />
          )}

          {audit.previewMeta && <PreviewCards preview={audit.previewMeta} />}

          {audit.flowData && <FlowScanTimeline flowData={audit.flowData} />}
        </div>
      )}

      {topFixPrompt && !explorerModel && (
        <section id="report-fix" className="scroll-mt-[var(--header-offset)] space-y-3">
          <SectionTitle>{OUTPUT_LABELS.fixPrompt}</SectionTitle>
          {aiLocked ? (
            <LockedContentTeaser
              label="Fix prompt - create a free account to view"
              signUpHref={signUpHref}
            />
          ) : (
            <Card className="p-4 sm:p-5">
              <FixPromptBlock
                prompt={topFixPrompt.prompt}
                finding={topFixPrompt.flag}
                showNextStep
                showCursorAction
                rows={5}
                clamp={false}
                nested
              />
            </Card>
          )}
        </section>
      )}

      {!isSample && (
        <section id="report-rubrics" className="scroll-mt-[var(--header-offset)] space-y-6">
          <div className="space-y-3">
            <SectionTitle>Summary by rubric</SectionTitle>
            <RubricSummaryGrid rubrics={audit.rubrics} rubricRows={audit.rubricRows} />
          </div>

          <div className="space-y-4">
            {RUBRIC_ORDER.map((rubricName) => {
              const rubric = audit.rubrics.find((r) => r.name === rubricName)
              const rubricRow = audit.rubricRows.find((r) => r.name === rubricName)
              if (!rubric || !rubricRow) return null
              return (
                <RubricCard
                  key={rubric.name}
                  rubric={rubric}
                  rubricRow={rubricRow}
                  showFeedback={showFeedback}
                  aiLocked={aiLocked}
                  signUpHref={signUpHref}
                  showFlagList={!explorerModel}
                />
              )
            })}
          </div>
        </section>
      )}

      <div id="report-recheck" className="scroll-mt-[var(--header-offset)] space-y-6 sm:space-y-8">
        {showRecheckHint && isLoggedIn && isViewerOwner && (
          <Card className="space-y-2 p-5">
            <CardTitle className="text-sm">{REPORT_COPY.recheckHint.title}</CardTitle>
            <p className="text-sm text-muted-foreground text-pretty">
              {REPORT_COPY.recheckHint.bodyPrefix}{' '}
              <strong>Re-check</strong> {REPORT_COPY.recheckHint.bodySuffix}
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

        {!isSample && aiLocked && (
          <Card className="space-y-3 p-6 text-center">
            <CardTitle>{UPSELLS.anon.headline}</CardTitle>
            <p className="text-sm text-muted-foreground">{UPSELLS.anon.body}</p>
            <div className="flex justify-center gap-3">
              <Button asChild>
                <Link href={signUpHref}>{UPSELLS.anon.primaryCta}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/pricing">{UPSELLS.anon.secondaryCta}</Link>
              </Button>
            </div>
          </Card>
        )}

        {!isSample && !isViewerOwner && (
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/#audit" className="text-link font-medium underline-offset-2 hover:underline">
              Run your own audit
            </Link>
          </p>
        )}

        {!isSample && isLoggedIn && !viewerIsPaid && showAiContent && (
          <ContextualUpgradeCard moment="report_completed" isLoggedIn currentPlan={viewerPlan} />
        )}

        {upgradeMoment && upgradeMoment !== 'free_default' && (
          <ContextualUpgradeCard
            moment={upgradeMoment}
            isLoggedIn
            currentPlan={viewerPlan}
            showCta={true}
          />
        )}

      </div>
    </Container>
    </>
  )
}
