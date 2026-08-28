import type { Route } from 'next'
import Link from 'next/link'
import { Callout } from '@/components/ui/callout'
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
      <p className="text-sm text-muted-foreground">
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
          <span className="mt-1 block text-xs text-muted-foreground">
            {RECHECK_DIFF_COPY.celebrationBody}
          </span>
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
