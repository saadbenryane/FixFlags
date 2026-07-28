'use client'

import { buildRubricOverview } from '@/lib/report/rubric-overview'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'
import type { RubricComputed } from '@/lib/audit/rubric'

interface RubricRow {
  name: string
  score: number | null
  grade: string | null
}

interface Props {
  rubrics: RubricComputed[]
  rubricRows: RubricRow[]
  /** Audit still running: pending rubrics show Scanning, not failing. */
  loading?: boolean
}

export function RubricBar({ rubrics, rubricRows, loading = false }: Props) {
  const overview = buildRubricOverview(rubrics, rubricRows, loading)

  return (
    <div className="flex flex-wrap items-center gap-3 sm:gap-4">
      {overview.map((item) => {
        const Icon = item.icon
        const countLabel =
          !item.pending && item.flagCount > 0
            ? item.criticalCount > 0
              ? `${item.criticalCount} critical`
              : `${item.flagCount} ${item.flagCount === 1 ? 'flag' : 'flags'}`
            : null

        return (
          <a
            key={item.name}
            href="#report-flags"
            className={cn(
              'group flex min-h-11 items-center gap-2 rounded-full border border-border/40 bg-card px-3 py-1.5',
              'transition-colors hover:border-border/70 hover:bg-accent/50'
            )}
          >
            {Icon && (
              <Icon
                className={cn('h-3.5 w-3.5 shrink-0', item.score != null ? '' : 'text-muted-foreground')}
                style={item.score != null ? { color: scoreToScanColor(item.score) } : undefined}
                aria-hidden
              />
            )}
            <span className="text-xs font-medium text-foreground">{item.label}</span>
            {item.status ? (
              <RubricStatusBadge
                status={item.status}
                size="sm"
                label={item.pending ? 'Scanning' : undefined}
                className="hidden sm:inline-flex"
              />
            ) : null}
            {countLabel ? (
              <span className="hidden text-2xs text-muted-foreground sm:inline">{countLabel}</span>
            ) : null}
          </a>
        )
      })}
    </div>
  )
}
