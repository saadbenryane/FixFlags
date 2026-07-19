'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { ScoreDot } from '@/components/ui/score-dot'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import { shareStatusMessage } from '@/lib/audit/share-status'
import { durationFromTimestamps } from '@/lib/audit/duration'
import { displayHostname } from '@/lib/utils/url-helpers'

type Props = {
  variant?: 'default' | 'minimal'
  score?: number | null
  pageType?: string | null
  verdict?: string | null
  url: string
  shareStatus: string
  screenshots?: AuditScreenshot[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  pageSpeedPartial?: boolean
  durationMs?: number | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  actions?: ReactNode
}

export function AuditReportHero({
  variant = 'default',
  score = null,
  pageType,
  url,
  shareStatus,
  screenshots,
  screenshotLimited = false,
  screenshotPartial = false,
  pageSpeedPartial = false,
  durationMs,
  startedAt,
  completedAt,
  actions,
}: Props) {
  const isMinimal = variant === 'minimal'
  const shareMessage = shareStatusMessage(shareStatus)
  const isReady = shareStatus === 'good_to_share'

  const hostname = displayHostname(url)

  const firstScreenshot = screenshots?.[0]
  const durationSec = durationFromTimestamps(durationMs, startedAt, completedAt)

  if (isMinimal) {
    return (
      <div className="space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <ScoreDot score={score} />
          <h1 className="truncate text-lg font-semibold tracking-heading text-foreground">
            {hostname}
          </h1>
        </div>
        <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {firstScreenshot && (
          <div className="hidden sm:block shrink-0">
            <Image
              src={firstScreenshot.url}
              alt={`Screenshot of ${hostname}`}
              width={80}
              height={56}
              className="w-20 rounded-[var(--radius-inner)] ring-1 ring-border/40 object-cover"
              style={{ aspectRatio: '1280 / 900' }}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ScoreDot score={score} aria-label={score != null ? `Overall score ${score} out of 100` : 'Overall score unavailable'} />
                <h1 className="text-lg font-semibold tracking-heading text-foreground">{hostname}</h1>
                {pageType ? (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {pageType}
                  </Badge>
                ) : null}
              </div>
              <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
                {actions}
              </div>
            )}
            {score != null && (
              <ScoreRingGauge score={score} size="sm" className="shrink-0 sm:hidden" />
            )}
          </div>

          <div className={isReady ? 'text-sm text-grade-A' : 'text-sm text-grade-C'}>
            <p className="font-medium text-pretty">{shareMessage}</p>
          </div>
        </div>
      </div>

      {durationSec != null && (
        <p className="text-xs text-muted-foreground font-mono tabular-nums">
          Audited in {durationSec}s
        </p>
      )}

      {(screenshotLimited || screenshotPartial || pageSpeedPartial) && (
        <div className="space-y-2">
          {screenshotLimited ? (
            <Callout variant="warning" title={REPORT_COPY.captureLimited.title}>
              {REPORT_COPY.captureLimited.body}
            </Callout>
          ) : null}
          {!screenshotLimited && screenshotPartial ? (
            <Callout variant="warning" title={REPORT_COPY.capturePartial.title}>
              {REPORT_COPY.capturePartial.body}
            </Callout>
          ) : null}
          {pageSpeedPartial ? (
            <Callout variant="neutral" title={REPORT_COPY.pageSpeedPartial.title}>
              {REPORT_COPY.pageSpeedPartial.body}
            </Callout>
          ) : null}
        </div>
      )}
    </div>
  )
}
