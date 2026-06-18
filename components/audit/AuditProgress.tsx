'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { Callout } from '@/components/ui/callout'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { getWorkerQueuedWarning } from '@/lib/marketing/worker-warning'
import {
  DESKTOP_FRAME_FLEX_CLASS,
  MOBILE_FRAME_WIDTH_CLASS,
  SCREENSHOT_FRAMES_ROW_CLASS,
} from '@/lib/audit/viewports'
import type { ScreenshotCaptureStatus } from '@/lib/audit/screenshot-types'
import {
  formatElapsed,
  getActivityMessage,
  getStageProgress,
  statusToStageIndex,
} from '@/lib/audit/progress-ui'
import { cn } from '@/lib/utils'

interface AuditProgressProps {
  status: string
  progress?: number | null
  score?: number | null
  url?: string
  startedAt?: string | null
  desktopScreenshotUrl?: string | null
  mobileScreenshotUrl?: string | null
  screenshotCapture?: ScreenshotCaptureStatus
  /** When true, skip inline worker warning (parent shows banner). */
  hideWorkerWarning?: boolean
}

export function AuditProgress({
  status,
  score,
  url,
  startedAt,
  desktopScreenshotUrl,
  mobileScreenshotUrl,
  screenshotCapture,
  hideWorkerWarning = false,
}: AuditProgressProps) {
  const [tick, setTick] = useState(0)
  const [queuedElapsed, setQueuedElapsed] = useState(0)
  const [runElapsed, setRunElapsed] = useState(0)

  const stageProgress = getStageProgress(status)
  const stageIdx = statusToStageIndex(status)
  const activeStage = AUDIT_PROGRESS.stages[stageIdx]?.status ?? status
  const activityMessage = getActivityMessage(activeStage, tick)
  const isTerminal = status === 'COMPLETED' || status === 'FAILED'
  const showWorkerWarning =
    !hideWorkerWarning &&
    process.env.NODE_ENV === 'development' &&
    status === 'QUEUED' &&
    queuedElapsed >= 30
  const displayElapsed = startedAt ? runElapsed : queuedElapsed
  const frameState = desktopScreenshotUrl
    ? 'loaded'
    : status === 'FAILED'
      ? 'failed'
      : 'loading'

  const mobilePending =
    screenshotCapture?.mobile === 'pending' && !mobileScreenshotUrl
  const showMobileFrame = mobileScreenshotUrl || mobilePending

  useEffect(() => {
    if (isTerminal) return
    const interval = setInterval(() => setTick((t) => t + 1), 2500)
    return () => clearInterval(interval)
  }, [isTerminal])

  useEffect(() => {
    if (isTerminal || status !== 'QUEUED') return
    const start = Date.now()
    const update = () => setQueuedElapsed(Math.floor((Date.now() - start) / 1000))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [isTerminal, status])

  useEffect(() => {
    if (!startedAt) return
    const start = new Date(startedAt).getTime()
    const update = () => setRunElapsed(Math.floor((Date.now() - start) / 1000))
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [startedAt])

  return (
    <div className="grid w-full gap-8 md:grid-cols-[minmax(0,1.75fr)_minmax(260px,1fr)] md:items-start">
      <div className={SCREENSHOT_FRAMES_ROW_CLASS}>
        <div className={DESKTOP_FRAME_FLEX_CLASS}>
          <BrowserFrame
            device="desktop"
            url={url}
            imageUrl={desktopScreenshotUrl}
            state={frameState}
          />
        </div>
        {showMobileFrame && (
          <div className={MOBILE_FRAME_WIDTH_CLASS}>
            <BrowserFrame
              device="mobile"
              url={url}
              imageUrl={mobileScreenshotUrl}
              state={mobileScreenshotUrl ? 'loaded' : 'loading'}
            />
          </div>
        )}
      </div>

      <div className="space-y-6 md:pt-2">
        {url && (
          <p className="text-sm text-muted-foreground truncate" title={url}>
            {url}
          </p>
        )}

        {score != null && (
          <div className="rounded-card border border-border/60 bg-card p-4 shadow-card">
            <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
              Overall score
            </p>
            <div className="mt-2 flex items-end gap-2">
              <span className="font-mono text-4xl font-bold leading-none tabular-nums">
                {score}
              </span>
              <span className="mb-1 text-xs text-muted-foreground">/ 100</span>
            </div>
            <div className="mt-3 h-1.5 rounded-full bg-muted/60">
              <div className="h-full rounded-full bg-brand" style={{ width: `${score}%` }} />
            </div>
          </div>
        )}

        {showWorkerWarning && (
          <Callout variant="warning" title="Worker starting">
            {getWorkerQueuedWarning()}
          </Callout>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium tabular-nums">
              Step {stageProgress.current} of {stageProgress.total}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {startedAt || status === 'QUEUED'
                ? formatElapsed(displayElapsed)
                : AUDIT_PROGRESS.usuallyUnder}
            </span>
          </div>
          <Progress
            value={stageProgress.percent}
            className="h-2 transition-[width] duration-500"
            aria-valuenow={stageProgress.percent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`Audit progress step ${stageProgress.current} of ${stageProgress.total}`}
          />
        </div>

        <p
          key={`${activityMessage}-${tick}`}
          className="text-sm text-foreground/90 animate-soft-reveal min-h-[1.25rem] text-pretty"
          aria-live="polite"
        >
          {activityMessage}
        </p>

        <div className="space-y-2">
          {AUDIT_PROGRESS.stages.map((stage, idx) => {
            const done = stageIdx > idx || status === 'COMPLETED'
            const active = stageIdx === idx && !isTerminal

            return (
              <div
                key={stage.status}
                className={cn(
                  'flex items-start gap-3 rounded-md px-3 py-2 transition-colors',
                  active && 'bg-muted/50'
                )}
              >
                {done ? (
                  <CheckCircle2 className="h-4 w-4 text-grade-A shrink-0 mt-0.5" />
                ) : active ? (
                  <Loader2 className="h-4 w-4 text-brand animate-spin shrink-0 mt-0.5" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/50 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <p
                    className={cn(
                      'text-sm leading-tight',
                      done && 'text-muted-foreground',
                      active && 'font-medium',
                      !done && !active && 'text-muted-foreground'
                    )}
                  >
                    {stage.label}
                  </p>
                  {active && (
                    <p className="text-xs text-muted-foreground mt-0.5">{stage.subtitle}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
