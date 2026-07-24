'use client'

import { useState } from 'react'
import { ChevronDown, Wrench } from 'lucide-react'
import { SeveritySignal } from '@/components/report/SeveritySignal'
import { cn } from '@/lib/utils'
import { rubricIcon, impactTagIcon } from '@/lib/rubric-icons'
import { rubricLabel, impactTagLabel } from '@/lib/utils'
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
  /** When flags are not loaded (e.g. live report hero), show this count instead */
  flagCount?: number
  selectedFlagId?: string | null
  onSelectFlag?: (id: string) => void
  defaultExpanded?: boolean
  compact?: boolean
  /** Audit still running: empty-state copy prefers scanning language. */
  loading?: boolean
  /**
    * `accordion` -- collapsible list (legacy / compact).
    * `panel` -- always-open full-width list for master-detail layouts.
   */
  variant?: 'accordion' | 'panel'
}

function FlagList({
  flags,
  selectedFlagId,
  onSelectFlag,
}: {
  flags: FixLoopFlagItem[]
  selectedFlagId?: string | null
  onSelectFlag?: (id: string) => void
}) {
  return (
    <ul className="space-y-1" aria-label="Report Flags">
      {flags.map((flag) => {
        const selected = selectedFlagId === flag.id
        const RubricIcon = rubricIcon(flag.rubric)
        const ImpactIcon = impactTagIcon(flag.impactTag)
        const categoryLabel = [rubricLabel(flag.rubric), impactTagLabel(flag.impactTag)]
          .filter(Boolean)
          .join(' · ')
        return (
          <li key={flag.id}>
            <button
              type="button"
              onClick={() => onSelectFlag?.(flag.id)}
              title={flag.title}
              aria-label={`${categoryLabel}: ${flag.title}`}
              aria-current={selected ? 'true' : undefined}
              aria-pressed={selected}
              aria-controls="selected-flag-detail"
              className={cn(
                'flex min-h-11 w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-xs leading-snug transition',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
                selected ? 'bg-brand/10 text-foreground' : 'hover:bg-muted/40'
              )}
            >
              <SeveritySignal severity={flag.severity} className="h-4 w-4" />
              <span
                className="flex shrink-0 items-center gap-1 rounded-full bg-muted/70 px-1.5 py-0.5 text-muted-foreground"
                title={categoryLabel}
              >
                <RubricIcon className="h-3 w-3" aria-hidden />
                {ImpactIcon && <ImpactIcon className="h-3 w-3" aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 truncate">{flag.title}</span>
              {flag.hasFixPrompt !== false && (
                <Wrench className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

export function ReportFixLoop({
  flags,
  flagCount,
  selectedFlagId,
  onSelectFlag,
  defaultExpanded = true,
  compact = false,
  loading = false,
  variant = 'accordion',
}: ReportFixLoopProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const count = flagCount ?? flags.length
  const interactive = flags.length > 0 && Boolean(onSelectFlag)

  const emptyOrList =
    count === 0 ? (
      <p className="px-1 py-2 text-xs text-muted-foreground">
        {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noFlagsNice}
      </p>
    ) : interactive ? (
      <FlagList flags={flags} selectedFlagId={selectedFlagId} onSelectFlag={onSelectFlag} />
    ) : (
      <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
        {count === 1 ? '1 check flagged' : `${count} checks flagged`}. Review the detail pane to copy
        fixes.
      </p>
    )

  if (variant === 'panel') {
    return <div className={cn(compact ? 'space-y-2' : 'space-y-2.5')}>{emptyOrList}</div>
  }

  return (
    <div className={cn('space-y-3', compact && 'space-y-2.5')}>
      <div className="rounded-nested-md bg-muted/25">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex min-h-11 w-full items-center justify-between gap-2 rounded-nested-md px-3 py-2.5 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
          aria-expanded={expanded}
        >
          <span className="meta-label text-muted-foreground">Flags</span>
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-2xs font-semibold tabular-nums text-brand">
              {count}
            </span>
            <ChevronDown
              className={cn(
                'h-4 w-4 text-muted-foreground transition-transform motion-safe:duration-200',
                expanded && 'rotate-180'
              )}
              aria-hidden
            />
          </span>
        </button>

        {expanded && <div className="space-y-1 px-1.5 pb-2 pt-1">{emptyOrList}</div>}
      </div>
    </div>
  )
}
