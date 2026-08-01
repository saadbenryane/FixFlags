'use client'

import { Wrench } from 'lucide-react'
import Link from 'next/link'
import type { Route } from 'next'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { cn } from '@/lib/utils'
import { rubricIcon, impactTagIcon } from '@/lib/rubric-icons'
import { rubricLabel, impactTagLabel, severityLabel } from '@/lib/utils'
import { REPORT_COPY } from '@/lib/marketing/copy'

export type FixLoopFlagItem = {
  id: string
  title: string
  rubric: string
  impactTag?: string | null
  severity: string
  hasFixPrompt?: boolean
}

export type ReportFixLoopProps = {
  flags: FixLoopFlagItem[]
  selectedFlagId?: string | null
  onSelectFlag?: (id: string) => void
  reportHref?: string
  compact?: boolean
  /** Audit still running: empty-state copy prefers scanning language. */
  loading?: boolean
}

function FlagList({
  flags,
  selectedFlagId,
  onSelectFlag,
  reportHref,
}: {
  flags: FixLoopFlagItem[]
  selectedFlagId?: string | null
  onSelectFlag?: (id: string) => void
  reportHref?: string
}) {
  return (
    <ul className="space-y-1" aria-label="Report Flags">
      {flags.map((flag) => {
        const selected = selectedFlagId === flag.id
        const RubricIcon = rubricIcon(flag.rubric)
        const ImpactIcon = impactTagIcon(flag.impactTag)
        const categoryLabel = [
          severityLabel(flag.severity),
          rubricLabel(flag.rubric),
          impactTagLabel(flag.impactTag),
        ]
          .filter(Boolean)
          .join(' · ')
        const content = (
          <>
            <SeveritySignal severity={flag.severity} className="h-4 w-4" />
            <span
              className="flex shrink-0 items-center gap-1 text-muted-foreground"
              title={categoryLabel}
            >
              <RubricIcon className="h-3.5 w-3.5" aria-hidden />
              {ImpactIcon && <ImpactIcon className="h-3.5 w-3.5" aria-hidden />}
            </span>
            <span className="min-w-0 flex-1 line-clamp-2">{flag.title}</span>
            {flag.hasFixPrompt !== false && (
              <Wrench className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
            )}
          </>
        )
        const rowClassName = cn(
          'flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm leading-snug transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
          selected ? 'bg-accent/55 text-foreground' : 'hover:bg-muted/45'
        )
        return (
          <li key={flag.id}>
            {reportHref ? (
              <Link
                href={`${reportHref}?flag=${encodeURIComponent(flag.id)}` as Route}
                title={flag.title}
                aria-label={`${categoryLabel}: ${flag.title}`}
                className={rowClassName}
              >
                {content}
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => onSelectFlag?.(flag.id)}
                title={flag.title}
                aria-label={`${categoryLabel}: ${flag.title}`}
                aria-current={selected ? 'true' : undefined}
                aria-pressed={selected}
                aria-controls="selected-flag-detail"
                className={rowClassName}
              >
                {content}
              </button>
            )}
          </li>
        )
      })}
    </ul>
  )
}

export function ReportFixLoop({
  flags,
  selectedFlagId,
  onSelectFlag,
  reportHref,
  compact = false,
  loading = false,
}: ReportFixLoopProps) {
  const interactive = flags.length > 0 && Boolean(onSelectFlag || reportHref)

  return (
    <div className={cn(compact ? 'space-y-2' : 'space-y-2.5')}>
      {interactive ? (
        <FlagList
          flags={flags}
          selectedFlagId={selectedFlagId}
          onSelectFlag={onSelectFlag}
          reportHref={reportHref}
        />
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noFlagsNice}
        </p>
      )}
    </div>
  )
}
