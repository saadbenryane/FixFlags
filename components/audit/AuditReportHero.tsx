'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { displayVerdict } from '@/lib/audit/verdict'
import { getUserFacingPageSpeedError } from '@/lib/audit/user-facing-errors'
import { rubricLabel } from '@/lib/utils'
import type { RubricComputed } from '@/lib/audit/rubric'

type Props = {
  variant?: 'default' | 'minimal'
  score?: number | null
  pageType?: string | null
  verdict?: string | null
  url: string
  shareStatus: string
  rubrics: RubricComputed[]
  screenshotLimited?: boolean
  screenshotPartial?: boolean
  pageSpeedPartial?: boolean
}

function shareStatusMessage(shareStatus: string, criticalCount: number): string {
  if (shareStatus === 'good_to_share') {
    return 'No critical Flags found. Good to share.'
  }
  if (criticalCount === 1) {
    return '1 critical. Fix this before sharing.'
  }
  return `${criticalCount} critical. Fix these before sharing.`
}

function ScanNotes({
  screenshotLimited,
  screenshotPartial,
  pageSpeedPartial,
}: Pick<Props, 'screenshotLimited' | 'screenshotPartial' | 'pageSpeedPartial'>) {
  const [open, setOpen] = useState(false)

  const notes: string[] = []
  if (screenshotLimited) {
    notes.push('Visual review limited. The desktop screenshot could not be captured.')
  } else if (screenshotPartial) {
    notes.push('Mobile screenshot could not be captured. Desktop viewport review is shown.')
  }
  if (pageSpeedPartial) {
    notes.push(getUserFacingPageSpeedError())
  }

  if (notes.length === 0) return null

  return (
    <div className="rounded-[var(--radius-inner)] border border-border/30 bg-muted/15">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-11 w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-muted-foreground"
        aria-expanded={open}
      >
        <span>Scan notes ({notes.length})</span>
        {open ? <ChevronUp className="h-4 w-4 shrink-0" /> : <ChevronDown className="h-4 w-4 shrink-0" />}
      </button>
      {open && (
        <ul className="space-y-1 border-t border-border/20 px-3 py-2 text-xs text-muted-foreground">
          {notes.map((note) => (
            <li key={note} className="text-pretty">
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function AuditReportHero({
  variant = 'default',
  score = null,
  pageType,
  verdict,
  url,
  shareStatus,
  rubrics,
  screenshotLimited,
  screenshotPartial,
  pageSpeedPartial,
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-5">
        <ScoreRingGauge score={score} size="sm" className="mx-auto sm:mx-0" />

        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-lg font-semibold tracking-tight text-foreground">{hostname}</h1>
              {pageType ? (
                <Badge variant="secondary" className="text-xs capitalize">
                  {pageType}
                </Badge>
              ) : null}
            </div>
            <p className="break-all text-xs text-muted-foreground sm:truncate">{url}</p>
          </div>

          <div className={isReady ? 'text-sm text-grade-A' : 'text-sm text-grade-C'}>
            <p className="font-medium text-pretty">{shareMessage}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {rubrics.map((r) => (
                <RubricStatusBadge
                  key={r.name}
                  status={r.status}
                  label={rubricLabel(r.name)}
                  size="sm"
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {userVerdict ? (
        <blockquote className="border-l-2 border-brand pl-3 font-sans text-base font-medium leading-[1.45] text-foreground text-pretty sm:pl-4 sm:text-lg">
          {userVerdict}
        </blockquote>
      ) : null}

      <ScanNotes
        screenshotLimited={screenshotLimited}
        screenshotPartial={screenshotPartial}
        pageSpeedPartial={pageSpeedPartial}
      />
    </div>
  )
}
