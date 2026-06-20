'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { Container } from '@/components/ui/container'
import { Skeleton } from '@/components/ui/skeleton'
import { SectionTitle } from '@/components/ui/typography'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { ReportScoreOverview } from '@/components/report/ReportScoreOverview'
import { RubricScoreBar } from '@/components/report/RubricScoreBar'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import {
  buildInProgressPipelineSteps,
  buildRubricScoreRows,
} from '@/lib/audit/report-pipeline-steps'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import { getActivityMessage, statusToStageIndex } from '@/lib/audit/progress-ui'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import { rubricDescription, rubricLabel, cn } from '@/lib/utils'
import {
  DESKTOP_FRAME_FLEX_CLASS,
  MOBILE_FRAME_WIDTH_CLASS,
  SCREENSHOT_FRAMES_ROW_CLASS,
} from '@/lib/audit/viewports'

interface AuditReportLoadingProps {
  status?: string
  url?: string
  score?: number | null
  flagCount?: number
  rubrics?: Array<{ name: string; grade: string; score: number | null }>
  desktopScreenshotUrl?: string | null
  mobileScreenshotUrl?: string | null
  screenshotCapture?: ScreenshotCaptureStatus
  workerIdle?: boolean
  /** Final packaging pass before server refresh. */
  finishing?: boolean
}

export function AuditReportLoading({
  status = 'QUEUED',
  url,
  score = null,
  flagCount = 0,
  rubrics = [],
  desktopScreenshotUrl,
  mobileScreenshotUrl,
  screenshotCapture,
  workerIdle = false,
  finishing = false,
}: AuditReportLoadingProps) {
  const [tick, setTick] = useState(0)
  const activeStatus = finishing ? 'FINALIZING' : status
  const stageIdx = statusToStageIndex(activeStatus)
  const activeStage = AUDIT_PROGRESS.stages[stageIdx]?.status ?? activeStatus
  const activityMessage = finishing
    ? 'Packaging your review...'
    : getActivityMessage(activeStage, tick)

  const pipelineSteps = buildInProgressPipelineSteps(activeStatus, flagCount)
  const rubricScores = buildRubricScoreRows(
    RUBRIC_ORDER.map((name) => {
      const row = rubrics.find((r) => r.name === name)
      return { name, score: row?.score ?? null, grade: row?.grade ?? null }
    })
  )

  const hostname = url
    ? (() => {
        try {
          return new URL(url).hostname
        } catch {
          return url
        }
      })()
    : null

  const frameState = desktopScreenshotUrl ? 'loaded' : 'loading'

  const mobilePending =
    screenshotCapture?.mobile === 'pending' && !mobileScreenshotUrl
  const showMobileFrame = mobileScreenshotUrl || mobilePending

  const showWorkerWarning =
    process.env.NODE_ENV === 'development' && activeStatus === 'QUEUED' && tick >= 12

  useEffect(() => {
    if (finishing) return
    const interval = setInterval(() => setTick((t) => t + 1), 2500)
    return () => clearInterval(interval)
  }, [finishing])

  return (
    <Container variant="report" className="space-y-6 py-6 sm:space-y-8 sm:py-8">
      <div className="space-y-4">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
            <Badge variant="secondary" className="text-xs capitalize">
              {finishing ? 'Packaging' : 'Scanning'}
            </Badge>
            {url ? (
              <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
            ) : (
              <Skeleton className="h-4 w-48" />
            )}
          </div>
          <p
            key={`${activityMessage}-${tick}`}
            className="text-sm text-muted-foreground animate-soft-reveal text-pretty"
            aria-live="polite"
          >
            {activityMessage}
          </p>
        </div>

        {(workerIdle || showWorkerWarning) && (
          <Callout variant="warning" title="Still preparing">
            {getWorkerQueuedWarning(workerIdle || showWorkerWarning)}
          </Callout>
        )}
      </div>

      <section className="overflow-hidden rounded-card glass-surface shadow-card">
        <div className="p-4 sm:p-6">
          <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(12rem,15rem)_minmax(0,1fr)] lg:items-start lg:gap-x-8 lg:gap-y-4">
            <aside className="min-w-0 self-start lg:col-start-1 lg:row-start-1">
              <ReportScoreOverview
                score={score}
                rubricScores={rubricScores}
                pipelineSteps={pipelineSteps}
                scoreSize="md"
                compact={false}
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
                    url={hostname ?? undefined}
                    imageUrl={desktopScreenshotUrl}
                    state={frameState}
                  />
                </div>
                {showMobileFrame && (
                  <div className={MOBILE_FRAME_WIDTH_CLASS}>
                    <BrowserFrame
                      device="mobile"
                      url={hostname ?? undefined}
                      imageUrl={mobileScreenshotUrl}
                      state={mobileScreenshotUrl ? 'loaded' : 'loading'}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <SectionTitle>Summary by rubric</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {RUBRIC_ORDER.map((name) => {
            const row = rubrics.find((r) => r.name === name)
            const label = rubricLabel(name)
            return (
              <div key={name} className="rounded-card glass-surface p-4 shadow-card">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold">{label}</h3>
                  {row?.grade ? (
                    <span className="font-mono text-xs text-muted-foreground">{row.grade}</span>
                  ) : (
                    <Skeleton className="h-4 w-8" />
                  )}
                </div>
                <div className="mb-3">
                  <RubricScoreBar name={label} score={row?.score ?? null} compact />
                </div>
                <p className="text-xs leading-snug text-muted-foreground text-pretty">
                  {rubricDescription(name)}
                </p>
              </div>
            )
          })}
        </div>
      </section>
    </Container>
  )
}

/** Static shell for route-level loading states. */
export function AuditReportLoadingShell() {
  return <AuditReportLoading />
}
