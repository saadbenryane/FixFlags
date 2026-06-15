'use client'

import { useEffect, useState } from 'react'
import { Clock, BookOpen } from 'lucide-react'
import { MARKETING_LINKS } from '@/lib/site/nav'
import { NavLink } from '@/components/layout/nav-link'
import { QUEUE_COPY, AUDIT_PROGRESS } from '@/lib/marketing/copy'
import {
  NAV_LINK_ACTIVE,
  NAV_LINK_BASE,
  NAV_LINK_INACTIVE,
} from '@/lib/site/nav-styles'

interface QueuePositionProps {
  queuePosition?: number
  estimatedSeconds: number
  scheduledStartAt?: string | null
  queueReason?: 'rate_limit' | 'backlog'
  isLoggedIn?: boolean
  workerIdle?: boolean
}

function formatWait(seconds: number): string {
  if (seconds <= 0) return 'Starting soon…'
  if (seconds < 60) return `~${seconds}s`
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return secs > 0 ? `~${mins}m ${secs}s` : `~${mins}m`
}

function secondsUntil(iso: string): number {
  const target = new Date(iso).getTime()
  return Math.max(0, Math.ceil((target - Date.now()) / 1000))
}

const browseLinks = MARKETING_LINKS.filter((l) =>
  ['/examples', '/samples', '/docs/mcp'].includes(l.href)
)

export function QueuePosition({
  queuePosition,
  estimatedSeconds,
  scheduledStartAt,
  queueReason,
  isLoggedIn,
  workerIdle = false,
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

  if (workerIdle) {
    return (
      <div
        className="space-y-3 rounded-card border border-dashed border-muted-foreground/30 bg-muted/30 p-4"
        role="status"
      >
        <p className="text-sm font-medium">Waiting for worker</p>
        <p className="text-sm text-muted-foreground">{AUDIT_PROGRESS.workerQueuedWarning}</p>
      </div>
    )
  }

  const statusLine = isRateLimited
    ? 'Your audit is queued'
    : queuePosition && queuePosition > 1
      ? `You\u2019re #${queuePosition} in queue`
      : 'You\u2019re next in queue'

  const waitLine =
    displaySeconds <= 0
      ? 'Starting soon…'
      : isRateLimited
        ? `Estimated start: ${formatWait(displaySeconds)}`
        : `Estimated wait: ${formatWait(displaySeconds)}`

  const progressWidth =
    scheduledStartAt && estimatedSeconds > 0
      ? `${Math.min(95, Math.max(5, 100 - (displaySeconds / estimatedSeconds) * 100))}%`
      : displaySeconds <= 0
        ? '90%'
        : '33%'

  return (
    <div className="space-y-4 rounded-card border-0 bg-card p-4 shadow-card" role="status">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand/10">
          <Clock className="h-4 w-4 text-brand" />
        </div>
        <div>
          <p className="text-sm font-medium">{statusLine}</p>
          <p className="text-xs text-muted-foreground">{waitLine}</p>
        </div>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-brand transition-all duration-1000 ease-linear"
          style={{ width: progressWidth }}
        />
      </div>
      <div className="space-y-2">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <BookOpen className="h-3.5 w-3.5 shrink-0" />
          {QUEUE_COPY.browseWhileWaiting}
        </p>
        <p className="text-xs text-muted-foreground">{QUEUE_COPY.prepMcp}</p>
        <div className="flex flex-wrap gap-2">
          {browseLinks.map((link) => (
            <NavLink
              key={link.href}
              href={link.href}
              className={`${NAV_LINK_BASE} text-xs`}
              activeClassName={NAV_LINK_ACTIVE}
              inactiveClassName={NAV_LINK_INACTIVE}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        {!isLoggedIn && (
          <p className="text-xs text-muted-foreground">
            <NavLink
              href="/sign-in"
              className="text-brand transition-colors duration-200 hover:text-brand/80"
              activeClassName="font-medium"
              inactiveClassName=""
            >
              Sign in
            </NavLink>{' '}
            for higher limits.
          </p>
        )}
      </div>
    </div>
  )
}
