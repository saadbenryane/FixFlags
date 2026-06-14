'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Clock, BookOpen } from 'lucide-react'

interface QueuePositionProps {
  queuePosition?: number
  estimatedSeconds: number
  scheduledStartAt?: string | null
  queueReason?: 'rate_limit' | 'backlog'
}

function formatWait(seconds: number): string {
  if (seconds < 60) return `~${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`
}

function secondsUntil(iso: string): number {
  const target = new Date(iso).getTime()
  return Math.max(0, Math.ceil((target - Date.now()) / 1000))
}

export function QueuePosition({
  queuePosition,
  estimatedSeconds,
  scheduledStartAt,
  queueReason,
}: QueuePositionProps) {
  const [remaining, setRemaining] = useState(() =>
    scheduledStartAt ? secondsUntil(scheduledStartAt) : estimatedSeconds
  )

  useEffect(() => {
    if (scheduledStartAt) {
      setRemaining(secondsUntil(scheduledStartAt))
      const interval = setInterval(() => {
        setRemaining(secondsUntil(scheduledStartAt))
      }, 1000)
      return () => clearInterval(interval)
    }
    setRemaining(estimatedSeconds)
  }, [scheduledStartAt, estimatedSeconds])

  const displaySeconds = scheduledStartAt ? remaining : estimatedSeconds
  const isRateLimited = queueReason === 'rate_limit'

  const statusLine = isRateLimited
    ? 'High demand — your audit is scheduled'
    : queuePosition && queuePosition > 1
      ? `You\u2019re #${queuePosition} in queue`
      : 'You\u2019re next in queue'

  const waitLine = isRateLimited
    ? `Estimated start: ${formatWait(displaySeconds)}`
    : `Estimated wait: ${formatWait(displaySeconds)}`

  const progressWidth =
    scheduledStartAt && estimatedSeconds > 0
      ? `${Math.min(95, Math.max(5, 100 - (displaySeconds / estimatedSeconds) * 100))}%`
      : '33%'

  return (
    <div className="rounded-lg border bg-card p-4 space-y-4" role="status">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <Clock className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-medium">{statusLine}</p>
          <p className="text-xs text-muted-foreground">{waitLine}</p>
        </div>
      </div>
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className="h-full bg-brand rounded-full transition-all duration-1000 ease-linear"
          style={{ width: progressWidth }}
        />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          Browse while you wait — your audit will continue in the background.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/examples"
            className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition-colors"
          >
            Example audits
          </Link>
          <Link
            href="/samples"
            className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition-colors"
          >
            Live sample
          </Link>
          <Link
            href="/docs/mcp"
            className="text-xs rounded-full border px-3 py-1.5 hover:bg-accent transition-colors"
          >
            MCP docs
          </Link>
        </div>
      </div>
    </div>
  )
}
