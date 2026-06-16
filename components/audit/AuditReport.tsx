import Link from 'next/link'
import { ReportMiniNav } from '@/components/audit/ReportMiniNav'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'
import { RubricCard } from '@/components/audit/RubricCard'
import { AuditReportHero } from '@/components/audit/AuditReportHero'
import { FlagSections } from '@/components/audit/FlagSections'
import { Button } from '@/components/ui/button'
import { Container } from '@/components/ui/container'
import { UPSELLS, REPORT_COPY, HERO } from '@/lib/marketing/copy'
import { ContextualUpgradeCard } from '@/components/billing/ContextualUpgradeCard'
import { resolveFreeUserUpgradeMoment } from '@/lib/billing/upgrade-moments'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { AuditPipelineProof } from '@/components/audit/AuditPipelineProof'
import { CompletenessHeader } from '@/components/audit/CompletenessHeader'
import type { PipelineLogEvent } from '@/lib/audit/pipeline-log'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import type { RubricComputed } from '@/lib/audit/rubric'
import type { RankableFlag } from '@/lib/audit/priority-flags'
import { SharedReportBanner } from '@/components/audit/SharedReportBanner'
import { ThirdPartyAuditDisclaimer } from '@/components/marketing/ThirdPartyAuditDisclaimer'
import { LaunchGates } from '@/components/audit/LaunchGates'
import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'

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

        {!isSample && !isViewerOwner && (
          <>
            <ThirdPartyAuditDisclaimer variant="compact" />
            <SharedReportBanner hostname={hostname} score={audit.score} />
          </>
        )}

        <CompletenessHeader
          hasScreenshots={(audit.screenshots?.length ?? 0) > 0}
          areasGradedCount={rubricsGradedCount}
          totalAreas={audit.rubricRows.length}
          hasFixPrompts={audit.flags.length > 0}
          canRecheck={viewerIsPaid || canUseFreeRecheck}
        />

        {audit.reportCompleteness !== 'FULL' && (
          <div
            role="status"
            className="rounded-card border-0 bg-grade-C/10 px-4 py-3 text-sm text-foreground shadow-card"
          >
            <p className="font-medium">Partial report</p>
            <p className="mt-1 text-muted-foreground">
              Some optional evidence was unavailable. Unassessed rubrics remain ungraded rather than
              being inferred.
            </p>
          </div>
        )}

        {audit.launchReadiness?.checklist && audit.launchReadiness.checklist.length > 0 && (
          <LaunchGates checklist={audit.launchReadiness.checklist} />
        )}

        {!isSample && isLoggedIn && !viewerIsPaid && (
          <ContextualUpgradeCard moment="report_completed" isLoggedIn currentPlan={viewerPlan} />
        )}
      </div>

      <ReportMiniNav />

      <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
        <FlagSections flags={audit.flags} showFeedback={showFeedback} />
      </section>

      <section id="report-rubrics" className="scroll-mt-[var(--header-offset)] space-y-6">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold tracking-heading">Summary by rubric</h2>
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
          <div className="surface-raised rounded-xl p-5 space-y-2 shadow-card">
            <h3 className="font-semibold text-sm">{REPORT_COPY.recheckHint.title}</h3>
            <p className="text-sm text-muted-foreground text-pretty">
              {REPORT_COPY.recheckHint.bodyPrefix}{' '}
              <strong>
                {canUseFreeRecheck && !viewerIsPaid ? 'Re-check free (1x)' : 'Re-check'}
              </strong>{' '}
              {REPORT_COPY.recheckHint.bodySuffix}
            </p>
          </div>
        )}

        {isSample && (
          <div className="surface-raised rounded-xl p-6 text-center space-y-3 shadow-card">
            <h3 className="font-semibold">{REPORT_COPY.sampleCta.title}</h3>
            <p className="text-sm text-muted-foreground text-pretty">{REPORT_COPY.sampleCta.body}</p>
            <Button asChild>
              <Link href="/">{HERO.primaryCta}</Link>
            </Button>
          </div>
        )}

        {!isSample && !isLoggedIn && (
          <div className="surface-raised rounded-xl p-6 text-center space-y-3 shadow-card">
            <h3 className="font-semibold">{UPSELLS.anon.headline}</h3>
            <p className="text-sm text-muted-foreground">{UPSELLS.anon.body}</p>
            <div className="flex justify-center gap-3">
              <Button asChild>
                <Link href={signUpHref}>{UPSELLS.anon.primaryCta}</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link href="/pricing">{UPSELLS.anon.secondaryCta}</Link>
              </Button>
            </div>
          </div>
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
