import Link from 'next/link'
import type { ReactNode } from 'react'
import { CheckCircle2, AlertTriangle, CircleDot, Plus } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Callout } from '@/components/ui/callout'
import { Button } from '@/components/ui/button'
import { RECHECK_DIFF_COPY, FLAG_STATUS_LABELS } from '@/lib/marketing/copy'
import { cn, rubricLabel } from '@/lib/utils'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'

export type RecheckDiffSummary = {
  fixed: FlagDiffSummaryItem[]
  unchanged: FlagDiffSummaryItem[]
  regressed: FlagDiffSummaryItem[]
  newIssues: FlagDiffSummaryItem[]
}

interface Props {
  summary: RecheckDiffSummary
  /** When the viewer can open Pro compare, link to the full before/after page. */
  compareHref?: string | null
  className?: string
}

/**
 * Free-tier proof strip on a child re-check report: Cleared / Remaining / New.
 * Pro compare stays the rich before/after; this is the honest habit loop for Free.
 */
export function RecheckDiffStrip({ summary, compareHref, className }: Props) {
  const { fixed, unchanged, regressed, newIssues } = summary
  const total =
    fixed.length + unchanged.length + regressed.length + newIssues.length
  if (total === 0) return null

  return (
    <section
      id="recheck-results"
      aria-labelledby="recheck-results-heading"
      className={cn('space-y-3', className)}
    >
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2
            id="recheck-results-heading"
            className="text-lg font-semibold tracking-tight text-foreground"
          >
            {RECHECK_DIFF_COPY.title}
          </h2>
        </div>
        {compareHref ? (
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link href={compareHref}>{RECHECK_DIFF_COPY.compareCta}</Link>
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            {RECHECK_DIFF_COPY.compareProHint}{' '}
            <Link href="/pricing" className="text-link font-medium underline-offset-2 hover:underline">
              {RECHECK_DIFF_COPY.compareProCta}
            </Link>
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label={RECHECK_DIFF_COPY.cleared}
          count={fixed.length}
          icon={<CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />}
          tone="success"
        />
        <Stat
          label={RECHECK_DIFF_COPY.remaining}
          count={unchanged.length}
          icon={<CircleDot className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
          tone="neutral"
        />
        <Stat
          label={RECHECK_DIFF_COPY.newIssues}
          count={newIssues.length}
          icon={<Plus className="h-3.5 w-3.5 text-brand" aria-hidden />}
          tone="info"
        />
        <Stat
          label={RECHECK_DIFF_COPY.regressed}
          count={regressed.length}
          icon={<AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-hidden />}
          tone="danger"
          hint={FLAG_STATUS_LABELS.REGRESSED.description}
        />
      </div>

      {fixed.length > 0 ? (
        <Callout
          variant="success"
          title={
            fixed.length === 1 ? '1 Flag fixed' : `${fixed.length} Flags fixed`
          }
        >
          <ul className="space-y-1.5">
            {fixed.slice(0, 5).map((item, i) => (
              <li
                key={`${item.checkId ?? item.problem}-${i}`}
                className="flex items-start gap-2 text-sm"
              >
                <CheckCircle2
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success"
                  aria-hidden
                />
                <span>
                  <span className="text-muted-foreground">
                    {rubricLabel(item.rubric)} ·{' '}
                  </span>
                  <span className="line-through text-muted-foreground">
                    {item.problem}
                  </span>
                </span>
              </li>
            ))}
            {fixed.length > 5 ? (
              <li className="text-xs text-muted-foreground">
                +{fixed.length - 5} more fixed
              </li>
            ) : null}
          </ul>
        </Callout>
      ) : null}
      <p className="text-xs text-muted-foreground">{RECHECK_DIFF_COPY.outcomesHint}</p>
    </section>
  )
}

function Stat({
  label,
  count,
  icon,
  tone,
  hint,
}: {
  label: string
  count: number
  icon: ReactNode
  tone: 'success' | 'neutral' | 'info' | 'danger'
  hint?: string
}) {
  return (
    <Card
      className={cn(
        'border-0 p-3 shadow-card',
        tone === 'success' && count > 0 && 'bg-success/5',
        tone === 'danger' && count > 0 && 'bg-destructive/5',
        tone === 'info' && count > 0 && 'bg-brand/5',
        tone === 'neutral' && 'bg-muted/30'
      )}
      title={hint}
    >
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
        {count}
      </div>
    </Card>
  )
}
