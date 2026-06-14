'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { BrowserFrame } from '@/components/audit/BrowserFrame'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
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
  url?: string
  startedAt?: string | null
  desktopScreenshotUrl?: string | null
  mobileScreenshotUrl?: string | null
  screenshotCapture?: ScreenshotCaptureStatus
}

export function AuditProgress({
  status,
  url,
  startedAt,
  desktopScreenshotUrl,
  mobileScreenshotUrl,
  screenshotCapture,
}: AuditProgressProps) {
  const [tick, setTick] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const stageProgress = getStageProgress(status)
  const stageIdx = statusToStageIndex(status)
  const activeStage = AUDIT_PROGRESS.stages[stageIdx]?.status ?? status
  const activityMessage = getActivityMessage(activeStage, tick)
  const isTerminal = status === 'COMPLETED' || status === 'FAILED'
  const showWorkerWarning =
    process.env.NODE_ENV === 'development' && status === 'QUEUED' && elapsed >= 30
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
    if (!startedAt) return
    const start = new Date(startedAt).getTime()
    const update = () => setElapsed(Math.floor((Date.now() - start) / 1000))
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

        {showWorkerWarning && (
          <p className="rounded-lg bg-brand/10 px-3 py-2 text-sm text-brand">
            {AUDIT_PROGRESS.workerQueuedWarning}
          </p>
        )}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium tabular-nums">
              Step {stageProgress.current} of {stageProgress.total}
            </span>
            <span className="text-muted-foreground tabular-nums">
              {startedAt ? formatElapsed(elapsed) : AUDIT_PROGRESS.usuallyUnder}
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
                  'flex items-start gap-3 rounded-lg px-3 py-2 transition-colors',
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
