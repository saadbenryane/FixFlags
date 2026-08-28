'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { Info } from 'lucide-react'
import { Callout } from '@/components/ui/callout'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { RECHECK_DIFF_COPY } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'

export type RecheckDiffSummary = {
  fixed: FlagDiffSummaryItem[]
  inconclusive: FlagDiffSummaryItem[]
  unchanged: FlagDiffSummaryItem[]
  regressed: FlagDiffSummaryItem[]
  newIssues: FlagDiffSummaryItem[]
}

interface Props {
  summary: RecheckDiffSummary
  /** Link to the full before/after compare page. */
  compareHref?: string | null
  /** When the child review is PARTIAL, inconclusive copy names the cause. */
  childPartial?: boolean
  className?: string
}

/**
 * Compact update-review signal under report chrome.
 * Full bucket detail lives on /compare/[id] — this is not a second hero.
 */
export function RecheckDiffStrip({
  summary,
  compareHref,
  childPartial = false,
  className,
}: Props) {
  const { fixed, inconclusive, unchanged, regressed, newIssues } = summary
  const total =
    fixed.length + inconclusive.length + unchanged.length + regressed.length + newIssues.length
  if (total === 0) return null

  const line = RECHECK_DIFF_COPY.summaryLine({
    stillOpen: unchanged.length,
    newlyFound: newIssues.length,
    inconclusive: inconclusive.length,
    cleared: fixed.length,
    regressed: regressed.length,
  })

  return (
    <section
      id="recheck-results"
      aria-label={RECHECK_DIFF_COPY.title}
      className={cn('space-y-2', className)}
    >
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-muted-foreground">
        {compareHref ? (
          <Link
            href={compareHref as Route}
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            {line || RECHECK_DIFF_COPY.compareCta}
          </Link>
        ) : (
          <span>{line}</span>
        )}
        {fixed.length > 0 ? (
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-control text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                  aria-label={RECHECK_DIFF_COPY.fixedInfoLabel}
                >
                  <Info className="h-3.5 w-3.5" aria-hidden />
                </button>
              </TooltipTrigger>
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
            </Tooltip>
          </TooltipProvider>
        ) : null}
      </p>
      {inconclusive.length > 0 ? (
        <Callout variant="warning" title={RECHECK_DIFF_COPY.inconclusive}>
          {childPartial
            ? RECHECK_DIFF_COPY.inconclusiveBodyPartial(inconclusive.length)
            : RECHECK_DIFF_COPY.inconclusiveBodyGeneric(inconclusive.length)}
        </Callout>
      ) : null}
    </section>
  )
}
