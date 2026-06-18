import Link from 'next/link'
import { ReportMiniNav } from '@/components/audit/ReportMiniNav'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'
import { RubricCard } from '@/components/audit/RubricCard'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { FixPromptBlock } from '@/components/audit/FixPromptBlock'
import { FlagSections } from '@/components/audit/FlagSections'
import { Button } from '@/components/ui/button'
import { Callout } from '@/components/ui/callout'
import { Card, CardTitle } from '@/components/ui/card'
import { Container } from '@/components/ui/container'
import { SectionTitle } from '@/components/ui/typography'
import { UPSELLS, REPORT_COPY, HERO, OUTPUT_LABELS } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { AuditPipelineProof } from '@/components/audit/AuditPipelineProof'
import { CompletenessHeader } from '@/components/audit/CompletenessHeader'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import {
  auditHasFixPrompts,
  getTopFixPromptFromFlags,
} from '@/lib/audit/priority-flags'
import { SharedReportBanner } from '@/components/audit/SharedReportBanner'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LaunchGates } from '@/components/audit/LaunchGates'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import { PreviewCards } from '@/components/audit/PreviewCards'
import { FlowScanTimeline } from '@/components/audit/FlowScanTimeline'
import type { PreviewMeta } from '@/lib/audit/preview-meta'
import type { FlowData } from '@/lib/audit/flow-data'

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
  }
  auditId?: string
  viewerIsPaid: boolean
  viewerPlan?: string
  isLoggedIn: boolean
  isViewerOwner?: boolean
  variant?: 'default' | 'sample'
  showRecheckHint?: boolean
  canUseFreeRecheck?: boolean
  hasUsedFreeRecheck?: boolean
  atAuditLimit?: boolean
  screenshotLimited?: boolean
  screenshotPartial?: boolean
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
  canUseFreeRecheck = false,
  hasUsedFreeRecheck = false,
  atAuditLimit = false,
  screenshotLimited = false,
  screenshotPartial = false,
}: AuditReportProps) {
  const isSample = variant === 'sample'
  const showFeedback = !isSample
  const signUpHref = auditId ? `/sign-up?next=/report/${auditId}` : '/sign-up'
  const hostname = (() => {
    try {
      return new URL(audit.url).hostname
    } catch {
      return audit.url
    }
  })()

  const rubricsGradedCount = audit.rubricRows.filter((r) => r.grade !== null).length
  const hasFixPrompts = auditHasFixPrompts(audit.flags)
  const topFixPrompt = getTopFixPromptFromFlags(audit.flags)
  const hasLaunchGates =
    (audit.launchReadiness?.checklist?.length ?? 0) > 0

  const upgradeMoment =
    !isSample && isLoggedIn && !viewerIsPaid
      ? resolveFreeUserUpgradeMoment({
          atAuditLimit,
          canUseFreeRecheck,
          hasUsedFreeRecheck,
        })
      : null

  return (
    <Container variant="report" className="space-y-8 py-8">
      <div id="report-overview" className="scroll-mt-[var(--header-offset)] space-y-8">
        <AuditReportHero
          pageJob={audit.pageJob}
          pageType={audit.pageType}
          verdict={audit.verdict}
          score={audit.score}
          url={audit.url}
          screenshots={audit.screenshots}
          screenshotLimited={screenshotLimited}
          screenshotPartial={screenshotPartial}
          shareStatus={audit.shareStatus}
          rubrics={audit.rubrics}
          pageSpeedPartial={audit.pageSpeedErrors?.pageSpeedPartial}
          desktopPageSpeedError={audit.pageSpeedErrors?.desktopError}
          mobilePageSpeedError={audit.pageSpeedErrors?.mobileError}
        />

        <ReportMiniNav
          showPreviews={Boolean(audit.previewMeta)}
          showFlow={Boolean(audit.flowData)}
          showFix={Boolean(topFixPrompt)}
          showLaunchGates={hasLaunchGates}
        />

        {!isSample && !isViewerOwner && (
          <>
            <ThirdPartyAuditDisclaimer variant="compact" />
            <SharedReportBanner hostname={hostname} score={audit.score} />
          </>
        )}

        <CompletenessHeader
          hasScreenshots={(audit.screenshots?.length ?? 0) > 0}
          rubricsGradedCount={rubricsGradedCount}
          totalRubrics={audit.rubricRows.length}
          hasFixPrompts={hasFixPrompts}
          canRecheck={viewerIsPaid || canUseFreeRecheck}
        />

        {audit.reportCompleteness !== 'FULL' && (
          <Callout variant="warning" title="Partial report">
            Some optional evidence was unavailable. Unassessed rubrics remain ungraded rather than
            being inferred.
          </Callout>
        )}

        {audit.launchReadiness?.checklist && audit.launchReadiness.checklist.length > 0 && (
          <LaunchGates checklist={audit.launchReadiness.checklist} />
        )}

        {audit.previewMeta && <PreviewCards preview={audit.previewMeta} />}

        {audit.flowData && <FlowScanTimeline flowData={audit.flowData} />}

        {!isSample && isLoggedIn && !viewerIsPaid && (
          <ContextualUpgradeCard moment="report_completed" isLoggedIn currentPlan={viewerPlan} />
        )}
      </div>

      <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
        <FlagSections flags={audit.flags} showFeedback={showFeedback} />
      </section>

      {topFixPrompt && (
        <section id="report-fix" className="scroll-mt-[var(--header-offset)] space-y-3">
          <SectionTitle>{OUTPUT_LABELS.fixPrompt}</SectionTitle>
          <Card className="p-5">
            <FixPromptBlock
              prompt={topFixPrompt.prompt}
              finding={topFixPrompt.flag}
              showNextStep
              showCursorAction
              rows={5}
              clamp={false}
            />
          </Card>
        </section>
      )}

      <section id="report-rubrics" className="scroll-mt-[var(--header-offset)] space-y-6">
        <div className="space-y-3">
          <SectionTitle>Summary by rubric</SectionTitle>
          <RubricSummaryGrid rubrics={audit.rubrics} />
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
              />
            )
          })}
        </div>
      </section>

      <div id="report-recheck" className="scroll-mt-[var(--header-offset)] space-y-8">
        {showRecheckHint && (viewerIsPaid || canUseFreeRecheck) && (
          <Card className="space-y-2 p-5">
            <CardTitle className="text-sm">{REPORT_COPY.recheckHint.title}</CardTitle>
            <p className="text-sm text-muted-foreground text-pretty">
              {REPORT_COPY.recheckHint.bodyPrefix}{' '}
              <strong>
                {canUseFreeRecheck && !viewerIsPaid ? 'Re-check free (1x)' : 'Re-check'}
              </strong>{' '}
              {REPORT_COPY.recheckHint.bodySuffix}
            </p>
          </Card>
        )}

        {isSample && (
          <Card className="space-y-3 p-6 text-center">
            <CardTitle>{REPORT_COPY.sampleCta.title}</CardTitle>
            <p className="text-sm text-muted-foreground text-pretty">{REPORT_COPY.sampleCta.body}</p>
            <Button asChild>
              <Link href="/">{HERO.primaryCta}</Link>
            </Button>
          </Card>
        )}

        {!isSample && !isLoggedIn && (
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

        {upgradeMoment && upgradeMoment !== 'free_default' && (
          <ContextualUpgradeCard
            moment={upgradeMoment}
            isLoggedIn
            currentPlan={viewerPlan}
            showCta={upgradeMoment !== 'trial_recheck_available'}
          />
        )}

        <AuditPipelineProof
          pipelineVersion={audit.pipelineVersion}
          pipelineLog={audit.pipelineLog}
          startedAt={audit.startedAt}
          completedAt={audit.completedAt}
        />
      </div>
    </Container>
  )
}
