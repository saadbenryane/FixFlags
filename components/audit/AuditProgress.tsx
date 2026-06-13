'use client'

import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'
import { Progress } from '@/components/ui/progress'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy-client'
import {
  formatElapsed,
  getActivityMessage,
  getProgressPercent,
  statusToStageIndex,
  truncateUrl,
} from '@/lib/audit/progress-ui'
import { cn } from '@/lib/utils'

interface AuditProgressProps {
  status: string
  progress?: number | null
  url?: string
  startedAt?: string | null
  desktopScreenshotUrl?: string | null
}

export function AuditProgress({
  status,
  progress,
  url,
  startedAt,
  desktopScreenshotUrl,
}: AuditProgressProps) {
  const [tick, setTick] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  const percent = getProgressPercent(progress, status)
  const stageIdx = statusToStageIndex(status)
  const activityMessage = getActivityMessage(percent, tick)
  const isTerminal = status === 'COMPLETED' || status === 'FAILED'

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
    <div className="w-full max-w-md space-y-6">
      {url && (
        <p className="text-center text-sm text-muted-foreground truncate" title={url}>
          {truncateUrl(url)}
        </p>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{percent}%</span>
          <span className="text-muted-foreground tabular-nums">
            {startedAt ? formatElapsed(elapsed) : AUDIT_PROGRESS.usuallyUnder}
          </span>
        </div>
        <Progress
          value={percent}
          className="h-2 transition-all duration-500"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Audit progress"
        />
      </div>

      <p
        key={`${activityMessage}-${tick}`}
        className="text-sm text-center text-foreground/90 animate-soft-reveal min-h-[1.25rem]"
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
                <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0 mt-0.5" />
              ) : active ? (
                <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0 mt-0.5" />
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

      {desktopScreenshotUrl && (
        <div className="animate-fade-in rounded-lg overflow-hidden border shadow-sm">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={desktopScreenshotUrl}
            alt="Desktop screenshot"
            className="w-full object-cover"
          />
        </div>
      )}
    </div>
  )
}
