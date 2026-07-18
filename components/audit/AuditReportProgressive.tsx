'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { ReportHeroHeader } from '@/components/audit/ReportHeroHeader'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'

const LiveReportExplorer = dynamic(
  () => import('@/components/audit/LiveReportExplorer').then((m) => m.LiveReportExplorer),
  {
    ssr: false,
    loading: () => (
      <div aria-hidden className="mt-6 h-64 animate-pulse rounded-card bg-muted/35" />
    ),
  }
)
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricStatus, type RubricComputed } from '@/lib/audit/rubric'
import { buildRubricScoreRows, reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import { displayHostname } from '@/lib/utils/url-helpers'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { getScanningLabel, statusToStageIndex, getProgressPercent } from '@/lib/audit/progress-ui'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { AUDIT_PROGRESS, formatQueueWaitHint } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { getActiveAudit } from '@/lib/audit/active-audit'

interface AuditReportProgressiveProps {
  status?: string
  url?: string
  pageType?: string | null
  verdict?: string | null
  score?: number | null
  progress?: number
  flagCount?: number
  rubrics?: Array<{ name: string; grade: string | null; score: number | null; status?: string | null }>
  partialFlags?: Array<{ id: string; severity: string; problem: string; rubric: string }>
  screenshots?: AuditScreenshot[]
  screenshotCapture?: ScreenshotCaptureStatus
  workerIdle?: boolean
}

function buildPartialRubricsComputed(
  rubrics: AuditReportProgressiveProps['rubrics'],
  partialFlags: NonNullable<AuditReportProgressiveProps['partialFlags']>
): RubricComputed[] {
  return RUBRIC_ORDER.map((name) => {
    const row = rubrics?.find((r) => r.name === name)
    const flagsForRubric = partialFlags.filter((f) => f.rubric === name)
    const criticalCount = flagsForRubric.filter((f) => f.severity === 'CRITICAL').length
    const importantCount = flagsForRubric.filter((f) => f.severity === 'IMPORTANT').length
    return {
      name,
      status: computeRubricStatus({
        name,
        grade: row?.grade ?? null,
        score: row?.score ?? null,
        flags: flagsForRubric.map((f) => ({ severity: f.severity })),
      }),
      flagCount: flagsForRubric.length,
      criticalCount,
      importantCount,
    }
  })
}

export function AuditReportProgressive({
  status = 'QUEUED',
  url = '',
  pageType = null,
  verdict = null,
  score = null,
  progress = 0,
  flagCount = 0,
  rubrics = [],
  partialFlags = [],
  screenshots = [],
  screenshotCapture,
  workerIdle = false,
}: AuditReportProgressiveProps) {
  const [tick, setTick] = useState(0)
  const stageIdx = statusToStageIndex(status)
  const activeStage = AUDIT_PROGRESS.stages[stageIdx]?.status ?? status
  const isLoading = status !== 'COMPLETED' && status !== 'FAILED'

  // Target progress from real backend state; eased client-side so the ring
  // advances continuously between 2s polls instead of jumping. Never exceeds
  // the backend value and never moves backward.
  const targetProgress = getProgressPercent(progress, status)
  const [displayProgress, setDisplayProgress] = useState(targetProgress)

  const showWorkerWarning =
    process.env.NODE_ENV === 'development' && status === 'QUEUED' && tick >= 12

  const [queueWaitSeconds, setQueueWaitSeconds] = useState<number | undefined>()

  useEffect(() => {
    if (status !== 'QUEUED') {
      setQueueWaitSeconds(undefined)
      return
    }
    setQueueWaitSeconds(getActiveAudit()?.estimatedWaitSeconds)
  }, [status])

  const showQueueWait =
    status === 'QUEUED' &&
    typeof queueWaitSeconds === 'number' &&
    queueWaitSeconds > 5 &&
    !workerIdle &&
    !showWorkerWarning

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    setDisplayProgress((prev) => {
      if (targetProgress <= prev) return prev
      // Ease ~40% of the remaining gap toward target each tick.
      const next = prev + Math.max(1, (targetProgress - prev) * 0.4)
      return Math.min(targetProgress, Math.round(next))
    })
  }, [tick, targetProgress])

  const rubricsComputed = useMemo(
    () => buildPartialRubricsComputed(rubrics, partialFlags),
    [rubrics, partialFlags]
  )

  const explorerModel = useMemo(() => {
    if (!url || partialFlags.length === 0) return null
    return buildPartialExplorerModel({
      url,
      pageType,
      score,
      verdict,
      flags: partialFlags,
      screenshots,
      rubrics,
    })
  }, [url, pageType, score, verdict, partialFlags, screenshots, rubrics])

  const rubricScores = buildRubricScoreRows(
    RUBRIC_ORDER.map((name) => {
      const row = rubrics.find((r) => r.name === name)
      return { name, score: row?.score ?? null, grade: row?.grade ?? null }
    })
  )

  const fixLoopFlags = partialFlags.map((f) => ({
    id: f.id,
    title: f.problem,
    rubric: f.rubric,
    impactTag: null,
    severity: f.severity,
    hasFixPrompt: false,
  }))

  const hostname = url ? displayHostname(url) : undefined

  const desktopScreenshotUrl = screenshots.find((s) => s.device === 'DESKTOP')?.url ?? null
  const mobileScreenshotUrl = screenshots.find((s) => s.device === 'MOBILE')?.url ?? null
  const mobilePending = screenshotCapture?.mobile === 'pending' && !mobileScreenshotUrl
  const showMobileFrame = mobileScreenshotUrl || mobilePending

  const rubricRowsForGrid = RUBRIC_ORDER.map((name) => {
    const row = rubrics.find((r) => r.name === name)
    return { name, score: row?.score ?? null, grade: row?.grade ?? null }
  })

  return (
    <Container variant="report" className="space-y-6 py-6 sm:space-y-8 sm:py-8">
      <div id="report-overview" className="scroll-mt-[var(--header-offset)] space-y-4">
        <ReportHeroHeader
          url={url}
          pageType={pageType}
          verdict={verdict}
        />

        {(workerIdle || showWorkerWarning) && (
          <Callout variant="warning" title="Still preparing">
            {getWorkerQueuedWarning(workerIdle || showWorkerWarning)}
          </Callout>
        )}

        {showQueueWait && queueWaitSeconds != null && (
          <Callout variant="info" title="Queued">
            {formatQueueWaitHint(queueWaitSeconds)}
          </Callout>
        )}
      </div>

      <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
        {explorerModel ? (
          <LiveReportExplorer
            model={explorerModel}
            hasFixPrompts={false}
            loading={isLoading}
            progress={displayProgress}
          />
        ) : (
          <div className="overflow-hidden rounded-card glass-surface shadow-card">
            <div className="space-y-6 p-4 sm:p-6">
              <ReportScoreOverview
                score={score}
                rubricScores={rubricScores}
                progress={displayProgress}
                fixLoop={{
                  scanDetail: isLoading
                    ? getScanningLabel(activeStage, tick)
                    : reportScanDetail(pageType),
                  flags: fixLoopFlags,
                  flagCount,
                  hasFixPrompts: false,
                  defaultExpanded: true,
                }}
                scoreSize="md"
                showProgress
                layout="split"
                loading={isLoading}
              />
              <div>
                <div className="mb-4 space-y-1">
                  <Skeleton className="h-5 w-3/4 max-w-sm" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <div className="flex flex-row items-start gap-4 sm:gap-6">
                  <div className="min-w-0 flex-1">
                    <BrowserFrame
                      device="desktop"
                      url={hostname}
                      imageUrl={desktopScreenshotUrl}
                      state={desktopScreenshotUrl ? 'loaded' : 'loading'}
                    />
                  </div>
                  {showMobileFrame && (
                    <div className="hidden w-[200px] max-w-full shrink-0 lg:block">
                      <BrowserFrame
                        device="mobile"
                        url={hostname}
                        imageUrl={mobileScreenshotUrl}
                        state={mobileScreenshotUrl ? 'loaded' : 'loading'}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section id="report-rubrics" className="scroll-mt-[var(--header-offset)] space-y-3">
        <SectionTitle>Summary by rubric</SectionTitle>
        <RubricSummaryGrid rubrics={rubricsComputed} rubricRows={rubricRowsForGrid} loading={isLoading} />
      </section>
    </Container>
  )
}

/** Static shell for route-level loading states. */
export function AuditReportProgressiveShell() {
  return <AuditReportProgressive />
}
