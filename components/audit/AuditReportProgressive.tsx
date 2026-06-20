'use client'

import { useEffect, useMemo, useState } from 'react'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { ReportHeroHeader } from '@/components/audit/ReportHeroHeader'
import { LiveReportExplorer } from '@/components/audit/LiveReportExplorer'
import { RubricSummaryGrid } from '@/components/audit/RubricSummaryGrid'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { computeRubricStatus, type RubricComputed } from '@/lib/audit/rubric'
import { buildRubricScoreRows, reportScanDetail } from '@/lib/audit/report-pipeline-steps'
import type { AuditScreenshot, ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { getActivityMessage, statusToStageIndex } from '@/lib/audit/progress-ui'
import { buildPartialExplorerModel } from '@/lib/report/explorer-model'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { cn } from '@/lib/utils'
import {
  DESKTOP_FRAME_FLEX_CLASS,
  MOBILE_FRAME_WIDTH_CLASS,
  SCREENSHOT_FRAMES_ROW_CLASS,
} from '@/lib/audit/viewports'

interface AuditReportProgressiveProps {
  status?: string
  url?: string
  pageType?: string | null
  verdict?: string | null
  score?: number | null
  flagCount?: number
  shareStatus?: string
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
  flagCount = 0,
  shareStatus,
  rubrics = [],
  partialFlags = [],
  screenshots = [],
  screenshotCapture,
  workerIdle = false,
}: AuditReportProgressiveProps) {
  const [tick, setTick] = useState(0)
  const stageIdx = statusToStageIndex(status)
  const activeStage = AUDIT_PROGRESS.stages[stageIdx]?.status ?? status
  const activityMessage = getActivityMessage(activeStage, tick)

  const showWorkerWarning =
    process.env.NODE_ENV === 'development' && status === 'QUEUED' && tick >= 12

  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 2500)
    return () => clearInterval(interval)
  }, [])

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
    severity: f.severity,
    hasFixPrompt: false,
  }))

  const hostname = url
    ? (() => {
        try {
          return new URL(url).hostname
        } catch {
          return url
        }
      })()
    : undefined

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
          activityMessage={activityMessage}
          shareStatus={shareStatus}
          rubrics={rubricsComputed}
        />

        {(workerIdle || showWorkerWarning) && (
          <Callout variant="warning" title="Still preparing">
            {getWorkerQueuedWarning(workerIdle || showWorkerWarning)}
          </Callout>
        )}
      </div>

      <section id="report-flags" className="scroll-mt-[var(--header-offset)]">
        <div className="overflow-hidden rounded-card glass-surface shadow-card">
          {explorerModel ? (
            <LiveReportExplorer model={explorerModel} hasFixPrompts={false} />
          ) : (
            <div className="p-4 sm:p-6">
              <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-4">
                <aside className="min-w-0 self-start lg:col-start-1 lg:row-start-1">
                  <ReportScoreOverview
                    score={score}
                    rubricScores={rubricScores}
                    fixLoop={{
                      scanDetail: reportScanDetail(pageType),
                      flags: fixLoopFlags,
                      flagCount,
                      hasFixPrompts: false,
                      defaultExpanded: true,
                    }}
                    scoreSize="md"
                    showProgress
                    layout="stacked"
                  />
                </aside>
                <div className="min-w-0 lg:col-start-2 lg:row-start-1">
                  <div className="mb-4 space-y-1">
                    <Skeleton className="h-5 w-3/4 max-w-sm" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className={cn('flex', SCREENSHOT_FRAMES_ROW_CLASS)}>
                    <div className={DESKTOP_FRAME_FLEX_CLASS}>
                      <BrowserFrame
                        device="desktop"
                        url={hostname}
                        imageUrl={desktopScreenshotUrl}
                        state={desktopScreenshotUrl ? 'loaded' : 'loading'}
                      />
                    </div>
                    {showMobileFrame && (
                      <div className={MOBILE_FRAME_WIDTH_CLASS}>
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
        </div>
      </section>

      <section id="report-rubrics" className="scroll-mt-[var(--header-offset)] space-y-3">
        <SectionTitle>Summary by rubric</SectionTitle>
        <RubricSummaryGrid rubrics={rubricsComputed} rubricRows={rubricRowsForGrid} />
      </section>
    </Container>
  )
}

/** Static shell for route-level loading states. */
export function AuditReportProgressiveShell() {
  return <AuditReportProgressive />
}
