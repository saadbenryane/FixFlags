'use client'

import Image from 'next/image'
import { Badge } from '@/components/ui/badge'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { displayVerdict } from '@/lib/audit/verdict'
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
  screenshots?: AuditScreenshot[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  pageSpeedPartial?: boolean
  durationMs?: number | null
  startedAt?: string | Date | null
  completedAt?: string | Date | null
}

function shareStatusMessage(shareStatus: string, criticalCount: number): string {
  if (shareStatus === 'good_to_share') {
    return 'No critical flags found. Good to share.'
  }
  if (criticalCount === 1) {
    return '1 critical. Fix this before sharing.'
  }
  return `${criticalCount} critical. Fix these before sharing.`
}

export function AuditReportHero({
  variant = 'default',
  score = null,
  pageType,
  verdict,
  url,
  shareStatus,
  rubrics,
  screenshots,
  durationMs,
  startedAt,
  completedAt,
}: Props) {
  const isMinimal = variant === 'minimal'
  const userVerdict = displayVerdict(verdict ?? null)
  const criticalCount = rubrics.reduce((sum, r) => sum + r.criticalCount, 0)
  const shareMessage = shareStatusMessage(shareStatus, criticalCount)
  const isReady = shareStatus === 'good_to_share'

  const hostname = (() => {
    try {
      return new URL(url).hostname
    } catch {
      return url
    }
  })()

  const firstScreenshot = screenshots?.[0]

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
        <h1 className="text-lg font-semibold tracking-tight text-foreground">{hostname}</h1>
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
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">{hostname}</h1>
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
            {score != null && (
              <ScoreRingGauge score={score} size="sm" className="shrink-0 sm:hidden" />
            )}
          </div>

          <div className={isReady ? 'text-sm text-grade-A' : 'text-sm text-grade-C'}>
            <p className="font-medium text-pretty">{shareMessage}</p>
          </div>
        </div>
      </div>

      {userVerdict ? (
        <blockquote className="border-l-2 border-brand pl-3 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:pl-4 sm:text-lg">
          {userVerdict}
        </blockquote>
      ) : null}

      {durationSec != null && (
        <p className="text-xs text-muted-foreground font-mono tabular-nums">
          Audited in {durationSec}s
        </p>
      )}
    </div>
  )
}
