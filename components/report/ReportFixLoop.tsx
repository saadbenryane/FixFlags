'use client'

import { useState } from 'react'
import { Check, ChevronDown, Loader2, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type FixLoopFlagItem = {
  id: string
  title: string
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

export function ReportFixLoop({
  scanDetail,
  flags,
  flagCount,
  selectedFlagId,
  onSelectFlag,
  defaultExpanded = true,
  compact = false,
  loading = false,
}: ReportFixLoopProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const count = flagCount ?? flags.length
  const interactive = flags.length > 0 && Boolean(onSelectFlag)

  return (
    <div className={cn('space-y-3', compact && 'space-y-2.5')}>
      <div className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 shrink-0 text-brand motion-safe:animate-spin" aria-hidden />
        ) : (
          <Check className="h-3.5 w-3.5 shrink-0 text-success" aria-hidden />
        )}
        <span>
          {loading ? 'Scanning' : 'Scanned'}
          <span className="text-muted-foreground/50"> · </span>
          <span className="text-foreground/80">{scanDetail}</span>
        </span>
      </div>

      <div className="rounded-nested-md bg-muted/25">
        <button
          type="button"
          onClick={() => setExpanded((open) => !open)}
          className="flex w-full items-center justify-between gap-2 rounded-nested-md px-3 py-2.5 text-left transition hover:bg-muted/40"
          aria-expanded={expanded}
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            Flags
          </span>
          <span className="flex items-center gap-1.5">
            <span className="rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[11px] font-semibold tabular-nums text-brand">
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
                {loading ? 'Checking for issues…' : 'No flags. Nice work.'}
              </p>
            ) : interactive ? (
              <ul className="space-y-1" role="listbox" aria-label="Report flags">
                {flags.map((flag) => {
                  const selected = selectedFlagId === flag.id
                  return (
                    <li key={flag.id} role="option" aria-selected={selected}>
                      <button
                        type="button"
                        onClick={() => onSelectFlag?.(flag.id)}
                        title={flag.title}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2 rounded-full px-3 py-2 text-left text-xs leading-none transition',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-0',
                          selected
                            ? 'bg-brand/10 text-foreground'
                            : 'hover:bg-muted/40'
                        )}
                      >
                        <SeverityDot severity={flag.severity} />
                        <span className="min-w-0 flex-1 truncate">{flag.title}</span>
                        {flag.hasFixPrompt !== false && (
                          <Sparkles className="h-3 w-3 shrink-0 text-brand/70" aria-hidden />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className="px-2 py-2 text-xs leading-relaxed text-muted-foreground">
                {count === 1 ? '1 check flagged' : `${count} checks flagged`}. Review below to
                copy fixes.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
