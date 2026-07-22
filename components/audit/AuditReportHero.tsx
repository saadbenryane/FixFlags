'use client'

import Image from 'next/image'
import { useEffect, useState, type ReactNode } from 'react'
import { ImageOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Callout } from '@/components/ui/callout'
import { Skeleton } from '@/components/ui/skeleton'
import { ScoreDot } from '@/components/ui/score-dot'
import { REPORT_COPY } from '@/lib/marketing/copy'
import {
  normalizeInternalScreenshotUrl,
  type AuditScreenshot,
} from '@/lib/audit/screenshot-types'
import { durationFromTimestamps } from '@/lib/audit/duration'
import { displayHostname } from '@/lib/utils/url-helpers'
import { cn } from '@/lib/utils'

type Props = {
  variant?: 'default' | 'minimal'
  score?: number | null
  pageType?: string | null
  url: string
  screenshots?: AuditScreenshot[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  pageSpeedPartial?: boolean
  durationMs?: number | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  actions?: ReactNode
  /** Pipeline status while the report is still building. */
  scanning?: boolean
  /** Live stage label (e.g. from getScanningLabel). Shown beside the Scanning badge. */
  scanningLabel?: string | null
}

export function AuditReportHero({
  variant = 'default',
  score = null,
  pageType,
  url,
  screenshots,
  screenshotLimited = false,
  screenshotPartial = false,
  pageSpeedPartial = false,
  durationMs,
  startedAt,
  completedAt,
  actions,
  scanning = false,
  scanningLabel = null,
}: Props) {
  const isMinimal = variant === 'minimal'
  const hostname = url ? displayHostname(url) : null
  const firstScreenshot = !scanning ? screenshots?.[0] : screenshots?.[0]
  const firstScreenshotUrl = firstScreenshot
    ? normalizeInternalScreenshotUrl(firstScreenshot.url)
    : null
  const [screenshotFailed, setScreenshotFailed] = useState(false)

  useEffect(() => {
    setScreenshotFailed(false)
  }, [firstScreenshotUrl])
  const durationSec = scanning
    ? null
    : durationFromTimestamps(durationMs, startedAt, completedAt)
  const badgeLabel = scanning
    ? scanningLabel
      ? `Scanning · ${scanningLabel}`
      : 'Scanning'
    : pageType

  if (isMinimal) {
    return (
      <div className="space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <ScoreDot
            score={score}
            className={cn(scanning && score == null && 'motion-safe:animate-pulse')}
          />
          <h1 className="truncate text-lg font-semibold tracking-heading text-foreground">
            {hostname ?? '…'}
          </h1>
        </div>
        {url ? (
          <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
        ) : null}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {firstScreenshot && (
          <div className="hidden sm:block shrink-0">
            {firstScreenshotUrl && !screenshotFailed ? (
              <Image
                src={firstScreenshotUrl}
                alt={`Screenshot of ${hostname ?? 'site'}`}
                width={80}
                height={56}
                className="w-20 rounded-[var(--radius-inner)] ring-1 ring-border/40 object-cover"
                style={{ aspectRatio: '1280 / 900' }}
                onError={() => setScreenshotFailed(true)}
              />
            ) : (
              <div
                className="flex aspect-[1280/900] w-20 items-center justify-center rounded-[var(--radius-inner)] bg-muted/55 text-muted-foreground ring-1 ring-border/40"
                aria-label="Screenshot preview unavailable"
              >
                <ImageOff className="h-4 w-4" aria-hidden />
              </div>
            )}
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <ScoreDot
                  score={score}
                  className={cn(scanning && score == null && 'motion-safe:animate-pulse')}
                  aria-label={
                    score != null
                      ? `Overall score ${score} out of 100`
                      : scanning
                        ? 'Score pending'
                        : 'Overall score unavailable'
                  }
                />
                {hostname ? (
                  <h1 className="text-lg font-semibold tracking-heading text-foreground">
                    {hostname}
                  </h1>
                ) : (
                  <Skeleton className="h-6 w-40" />
                )}
                {badgeLabel ? (
                  <Badge
                    variant="secondary"
                    className={cn('text-xs capitalize', scanning && 'normal-case')}
                  >
                    {badgeLabel}
                  </Badge>
                ) : null}
              </div>
              {url ? (
                <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
              ) : (
                <Skeleton className="h-3 w-56" />
              )}
            </div>
            {actions && (
              <div className="flex shrink-0 flex-wrap items-center justify-start gap-2 lg:justify-end">
                {actions}
              </div>
            )}
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
