'use client'

import { Info } from 'lucide-react'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RECHECK_DIFF_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'
import type { ReactNode } from 'react'

export type RecheckDiffSummary = {
  fixed: FlagDiffSummaryItem[]
  inconclusive: FlagDiffSummaryItem[]
  unchanged: FlagDiffSummaryItem[]
  regressed: FlagDiffSummaryItem[]
  newIssues: FlagDiffSummaryItem[]
}

interface Props {
  summary: RecheckDiffSummary
  /** When the child review is PARTIAL, inconclusive tooltip names the cause. */
  childPartial?: boolean
  className?: string
}

type Bucket = {
  key: string
  label: string
  count: number
  info?: ReactNode
}

/**
 * Compact update-review count cards (Product page under score chart).
 * Cards are the outcome story - not links, not a second hero banner.
 */
export function RecheckDiffStrip({
  summary,
  childPartial = false,
  className,
}: Props) {
  const { fixed, inconclusive, unchanged, regressed, newIssues } = summary
  const total =
    fixed.length + inconclusive.length + unchanged.length + regressed.length + newIssues.length
  if (total === 0) return null

  const buckets: Bucket[] = [
    {
      key: 'fixed',
      label: RECHECK_DIFF_COPY.cleared,
      count: fixed.length,
      info:
        fixed.length > 0 ? (
          <TooltipContent side="bottom" align="start" className="max-w-xs space-y-1.5 p-3">
            <p className="text-xs font-medium text-foreground">
              {RECHECK_DIFF_COPY.fixedInfoIntro}
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {fixed.map((item, i) => (
                <li key={`${item.checkId ?? item.problem}-${i}`}>{item.problem}</li>
              ))}
            </ul>
          </TooltipContent>
        ) : null,
    },
    {
      key: 'open',
      label: RECHECK_DIFF_COPY.remaining,
      count: unchanged.length,
    },
    {
      key: 'new',
      label: RECHECK_DIFF_COPY.newIssues,
      count: newIssues.length,
      info:
        newIssues.length > 0 ? (
          <TooltipContent side="bottom" align="start" className="max-w-xs space-y-1.5 p-3">
            <p className="text-xs font-medium text-foreground">
              {RECHECK_DIFF_COPY.newInfoIntro}
            </p>
            <ul className="space-y-1 text-xs text-muted-foreground">
              {newIssues.map((item, i) => (
                <li key={`${item.checkId ?? item.problem}-${i}`}>
                  {item.problem}
                  {item.foundOnNewPage ? ` (${RECHECK_DIFF_COPY.foundOnNewPage})` : ''}
                </li>
              ))}
            </ul>
          </TooltipContent>
        ) : null,
    },
    {
      key: 'regressed',
      label: RECHECK_DIFF_COPY.regressed,
      count: regressed.length,
    },
    {
      key: 'inconclusive',
      label: RECHECK_DIFF_COPY.inconclusive,
      count: inconclusive.length,
      info:
        inconclusive.length > 0 ? (
          <TooltipContent side="bottom" align="start" className="max-w-xs p-3">
            <p className="text-xs text-muted-foreground">
              {childPartial
                ? RECHECK_DIFF_COPY.inconclusiveNotePartial(inconclusive.length)
                : RECHECK_DIFF_COPY.inconclusiveNoteGeneric(inconclusive.length)}
            </p>
          </TooltipContent>
        ) : null,
    },
  ].filter((bucket) => bucket.count > 0)

  if (buckets.length === 0) return null

  return (
    <section
      id="recheck-results"
      aria-label={RECHECK_DIFF_COPY.title}
      className={cn('w-full', className)}
    >
      <TooltipProvider delayDuration={200}>
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
          {buckets.map((bucket) => (
            <li
              key={bucket.key}
              className="flex min-h-14 flex-col justify-center rounded-[var(--radius-inner)] border border-border/45 bg-background px-3 py-2"
            >
              <div className="flex items-center gap-1">
                <span className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
                  {bucket.label}
                </span>
                {bucket.info ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-5 w-5 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                        aria-label={
                          bucket.key === 'fixed'
                            ? RECHECK_DIFF_COPY.fixedInfoLabel
                            : bucket.key === 'new'
                              ? RECHECK_DIFF_COPY.newInfoLabel
                              : RECHECK_DIFF_COPY.inconclusive
                        }
                      >
                        <Info className="h-3 w-3" aria-hidden />
                      </button>
                    </TooltipTrigger>
                    {bucket.info}
                  </Tooltip>
                ) : null}
              </div>
              <span className="font-mono text-lg font-semibold tabular-nums text-foreground">
                {bucket.count}
              </span>
            </li>
          ))}
        </ul>
      </TooltipProvider>
    </section>
  )
}
