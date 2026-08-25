'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils'
import { impactTagLabel, severityLabel } from '@/lib/utils'
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
    <ul className="space-y-1" style={{ listStyle: 'none' }} aria-label="Report Flags">
      {flags.map((flag, index) => {
        const selected = selectedFlagId === flag.id
        const categoryLabel = [
          severityLabel(flag.severity),
          impactTagLabel(flag.impactTag),
        ]
          .filter(Boolean)
          .join(' · ')
        const content = (
          <>
            <span className="mt-0.5 font-mono text-2xs font-semibold tabular-nums text-muted-foreground">{index + 1}</span>
            <span className="min-w-0 flex-1"><span className="line-clamp-2">{flag.title}</span><span className="mt-1 block text-3xs text-muted-foreground">{categoryLabel}</span></span>
          </>
        )
        const rowClassName = cn(
          'flex min-h-11 w-full min-w-0 items-center gap-2.5 rounded-[var(--radius-control)] px-3 py-2.5 text-left text-sm leading-snug transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
          selected ? 'bg-accent/55 text-foreground' : 'hover:bg-muted/45'
        )
        return (
          <li
            key={flag.id}
            className="list-none"
            style={{ listStyle: 'none' }}
          >
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
  loading = false,
}: ReportFixLoopProps) {
  const interactive = flags.length > 0 && Boolean(onSelectFlag || reportHref)

  return (
    <div className="space-y-2.5">
      {interactive ? (
        <FlagList flags={flags} selectedFlagId={selectedFlagId} onSelectFlag={onSelectFlag} reportHref={reportHref} />
      ) : (
        <p className="px-1 py-2 text-xs text-muted-foreground">
          {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noFlagsNice}
        </p>
      )}
    </div>
  )
}
