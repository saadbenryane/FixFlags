'use client'

import { useState } from 'react'
import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { rubricIcon, impactTagIcon } from '@/lib/rubric-icons'
import { rubricLabel, impactTagLabel } from '@/lib/utils'
import { priorityLabelForIndex } from '@/lib/report/explorer-filters'
import { REPORT_COPY } from '@/lib/marketing/copy'

export type FixLoopFlagItem = {
  id: string
  title: string
  priorityLabel?: string
  rubric: string
  impactTag?: string | null
  severity: string
  hasFixPrompt?: boolean
}

export type ReportFixLoopProps = {
  scanDetail: string
  flags: FixLoopFlagItem[]
  /** When flags are not loaded (e.g. live report hero), show this count instead */
  flagCount?: number
  selectedFlagId?: string | null
  onSelectFlag?: (id: string) => void
  hasFixPrompts?: boolean
  defaultExpanded?: boolean
  compact?: boolean
  /** Audit still running: show a scanning state instead of a completed summary. */
  loading?: boolean
  /**
    * `accordion` -- collapsible list (legacy / compact).
    * `panel` -- always-open full-width list for master-detail layouts.
   */
  variant?: 'accordion' | 'panel'
}

function SeverityDot({ severity }: { severity: string }) {
  const isCritical = severity === 'CRITICAL'
  const isImportant = severity === 'IMPORTANT'
  return (
    <span
      className={cn(
        'h-2 w-2 shrink-0 rounded-full',
        isCritical && 'bg-destructive',
        isImportant && 'bg-brand',
        !isCritical && !isImportant && 'bg-muted-foreground/40'
      )}
      aria-hidden
    />
  )
}

function FlagList({
  flags,
  selectedFlagId,
  onSelectFlag,
  hasFixPrompts,
  showActiveSummary,
}: {
  flags: FixLoopFlagItem[]
  selectedFlagId?: string | null
  onSelectFlag?: (id: string) => void
  hasFixPrompts?: boolean
  showActiveSummary?: boolean
}) {
  const selectedIndex = selectedFlagId ? flags.findIndex((flag) => flag.id === selectedFlagId) : -1
  const activeFlag = selectedIndex >= 0 ? flags[selectedIndex] : flags[0]
  const activePriority =
    activeFlag?.priorityLabel ?? priorityLabelForIndex(selectedIndex >= 0 ? selectedIndex : 0)
  const activePromptReady = activeFlag?.hasFixPrompt !== false && hasFixPrompts !== false

  return (
    <>
      {showActiveSummary && activeFlag && (
        <div className="flex items-center justify-between gap-2 px-1 pb-1.5 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            <span className="font-medium text-foreground">{activePriority}</span>
            <span className="text-muted-foreground/50"> · </span>
            {activePromptReady ? 'Copy fix prompt' : 'Evidence only'}
          </span>
        </div>
      )}
      <ul className="space-y-1" role="listbox" aria-label="Report flags">
        {flags.map((flag) => {
          const selected = selectedFlagId === flag.id
          const RubricIcon = rubricIcon(flag.rubric)
          const ImpactIcon = impactTagIcon(flag.impactTag)
          const categoryLabel = [rubricLabel(flag.rubric), impactTagLabel(flag.impactTag)]
            .filter(Boolean)
            .join(' · ')
          return (
            <li key={flag.id} role="option" aria-selected={selected}>
              <button
                type="button"
                onClick={() => onSelectFlag?.(flag.id)}
                title={flag.title}
                aria-label={`${categoryLabel}: ${flag.title}`}
                className={cn(
                  'flex w-full min-w-0 items-center gap-2 rounded-md px-2.5 py-2.5 text-left text-xs leading-snug transition',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
                  selected ? 'bg-brand/10 text-foreground' : 'hover:bg-muted/40'
                )}
              >
                <SeverityDot severity={flag.severity} />
                <span
                  className="flex shrink-0 items-center gap-1 rounded-full bg-muted/70 px-1.5 py-0.5 text-muted-foreground"
                  title={categoryLabel}
                >
                  <RubricIcon className="h-3 w-3" aria-hidden />
                  {ImpactIcon && <ImpactIcon className="h-3 w-3" aria-hidden />}
                </span>
                <span className="min-w-0 flex-1 truncate">{flag.title}</span>
                {flag.hasFixPrompt !== false && (
                  <Sparkles className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </>
  )
}

export function ReportFixLoop({
  scanDetail,
  flags,
  flagCount,
  selectedFlagId,
  onSelectFlag,
  hasFixPrompts,
  defaultExpanded = true,
  compact = false,
  loading = false,
  variant = 'accordion',
}: ReportFixLoopProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const count = flagCount ?? flags.length
  const interactive = flags.length > 0 && Boolean(onSelectFlag)

  if (variant === 'panel') {
    return (
      <div className={cn('space-y-2.5', compact && 'space-y-2')}>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
          ) : (
            <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
          )}
          <span className="min-w-0 truncate">
            {loading ? REPORT_COPY.explorer.scanning : REPORT_COPY.explorer.scanned}
            <span className="text-muted-foreground/50"> · </span>
            <span className="text-foreground/80">{scanDetail}</span>
          </span>
          <span className="ml-auto rounded-full bg-brand/10 px-2 py-0.5 font-mono text-2xs font-semibold tabular-nums text-brand">
            {count}
          </span>
        </div>

        {count === 0 ? (
          <p className="px-1 py-2 text-xs text-muted-foreground">
            {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noFlagsNice}
          </p>
        ) : interactive ? (
          <FlagList
            flags={flags}
            selectedFlagId={selectedFlagId}
            onSelectFlag={onSelectFlag}
            hasFixPrompts={hasFixPrompts}
            showActiveSummary
          />
        ) : (
          <p className="px-1 py-2 text-xs leading-relaxed text-muted-foreground">
            {count === 1 ? '1 check flagged' : `${count} checks flagged`}. Review the detail pane to
            copy fixes.
          </p>
        )}
      </div>
    )
  }

  return (
    <div className={cn('space-y-3', compact && 'space-y-2.5')}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
        )}
        <span>
          {loading ? REPORT_COPY.explorer.scanning : REPORT_COPY.explorer.scanned}
          <span className="text-muted-foreground/50"> · </span>
          <span className="text-foreground/80">{scanDetail}</span>
        </span>
      </div>

      <div className="rounded-nested-md bg-muted/25">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex w-full items-center justify-between gap-2 rounded-nested-md px-3 py-2.5 text-left transition hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus-ring"
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

        {expanded && (
          <div className="space-y-1 px-1.5 pb-2 pt-1">
            {count === 0 ? (
              <p className="px-2 py-2 text-xs text-muted-foreground">
                {loading ? REPORT_COPY.explorer.checkingIssues : REPORT_COPY.explorer.noFlagsNice}
              </p>
            ) : interactive ? (
              <FlagList
                flags={flags}
                selectedFlagId={selectedFlagId}
                onSelectFlag={onSelectFlag}
                hasFixPrompts={hasFixPrompts}
                showActiveSummary
              />
            ) : (
              <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
                {count === 1 ? '1 check flagged' : `${count} checks flagged`}. Review below to copy
                fixes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
