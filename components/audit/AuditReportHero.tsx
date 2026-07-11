'use client'

import Image from 'next/image'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import type { AuditScreenshot } from '@/lib/audit/screenshot-types'
import type { RubricComputed } from '@/lib/audit/rubric'

type Props = {
  variant?: 'default' | 'minimal'
  score?: number | null
  pageType?: string | null
  verdict?: string | null
  url: string
  shareStatus: string
  rubrics: RubricComputed[]
  totalFlags?: number
  screenshots?: AuditScreenshot[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  pageSpeedPartial?: boolean
  durationMs?: number | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
  actions?: ReactNode
}

function shareStatusMessage(
  shareStatus: string,
  criticalCount: number,
  totalFlags: number
): string {
  if (shareStatus === 'good_to_share') {
    return 'No critical flags found. Good to share.'
  }
  if (criticalCount === 1) {
    return totalFlags > 1
      ? `1 critical of ${totalFlags} flags. Fix this before sharing.`
      : '1 critical. Fix this before sharing.'
  }
  return totalFlags > criticalCount
    ? `${criticalCount} critical of ${totalFlags} flags. Fix critical before sharing.`
    : `${criticalCount} critical. Fix these before sharing.`
}

export function AuditReportHero({
  variant = 'default',
  score = null,
  pageType,
  url,
  shareStatus,
  rubrics,
  totalFlags = 0,
  screenshots,
  durationMs,
  startedAt,
  completedAt,
  actions,
}: Props) {
  const isMinimal = variant === 'minimal'
  const criticalCount = rubrics.reduce((sum, r) => sum + r.criticalCount, 0)
  const flagTotal = totalFlags || rubrics.reduce((sum, r) => sum + r.flagCount, 0)
  const shareMessage = shareStatusMessage(shareStatus, criticalCount, flagTotal)
  const isReady = shareStatus === 'good_to_share'

  const hostname = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  })()

  const firstScreenshot = screenshots?.[0]
  const scoreColor = score != null ? scoreToScanColor(score) : 'hsl(var(--muted-foreground))'

  const durationSec =
    durationMs != null
      ? Math.round(durationMs / 1000)
      : startedAt && completedAt
        ? Math.round(
            (new Date(completedAt).getTime() - new Date(startedAt).getTime()) / 1000
          )
        : null

  if (isMinimal) {
    return (
      <div className="space-y-1">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_currentColor]"
            style={{ color: scoreColor, backgroundColor: scoreColor, opacity: 0.9 }}
            aria-hidden
          />
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
              className="w-20 rounded-[var(--radius-inner)] border border-border/40 object-cover"
              style={{ aspectRatio: '1280 / 900' }}
            />
          </div>
        )}

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full shadow-[0_0_0_3px_currentColor]"
                  style={{ color: scoreColor, backgroundColor: scoreColor, opacity: 0.9 }}
                  aria-label={score != null ? `Overall score ${score} out of 100` : 'Overall score unavailable'}
                />
                <h1 className="text-lg font-semibold tracking-heading text-foreground">{hostname}</h1>
                {pageType ? (
                  <Badge variant="secondary" className="text-xs capitalize">
                    {pageType}
                  </Badge>
                ) : null}
                {score != null && (
                  <span className="text-xs text-muted-foreground font-medium tabular-nums">
                    {score}/100
                  </span>
                )}
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
    </div>
  )
}
