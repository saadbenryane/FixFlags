'use client'

import { buildRubricOverview } from '@/lib/report/rubric-overview'
import { rubricStatusColor, cn } from '@/lib/utils'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { RubricScoreBar } from '@/components/report/RubricScoreBar'
import { Card } from '@/components/ui/card'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import type { RubricComputed } from '@/lib/audit/rubric'

interface RubricRowInput {
  name: string
  score: number | null
  grade?: string | null
}

interface Props {
  rubrics: RubricComputed[]
  rubricRows?: RubricRowInput[]
  /** Audit still running: render rubrics with no data yet as pending, not failing. */
  loading?: boolean
  /** Name of the rubric currently expanded below the grid, if any. */
  activeName?: string | null
  /** When provided, cards become selectable tiles that expand detail in place instead of jump-scrolling. */
  onSelect?: (name: string) => void
}

export function RubricSummaryGrid({ rubrics, rubricRows, loading = false, activeName, onSelect }: Props) {
  const overview = buildRubricOverview(rubrics, rubricRows ?? [], loading)

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {overview.map((rubric) => {
        const status = rubric.status ?? 'NEEDS_ATTENTION'
        return (
          <Card
            key={rubric.name}
            interactive={Boolean(onSelect)}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onClick={onSelect ? () => onSelect(rubric.name) : undefined}
            onKeyDown={
              onSelect
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      onSelect(rubric.name)
                    }
                  }
                : undefined
            }
            className={cn(
              'p-4 text-left',
              onSelect && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
              activeName === rubric.name && 'ring-2 ring-brand/50',
              rubricStatusColor(status)
            )}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{rubric.label}</h3>
              <RubricStatusBadge status={status} size="sm" />
            </div>
            <div className="mb-3">
              <RubricScoreBar name={rubric.label} score={rubric.score} compact />
            </div>
            <p className="mb-3 text-xs leading-snug text-muted-foreground text-pretty">
              {rubric.description}
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {rubric.flagCount > 0 ? (
                <span>
                  {rubric.flagCount} Flag{rubric.flagCount !== 1 ? 's' : ''}
                  {rubric.criticalCount > 0 && (
                    <span className="ml-1 font-medium text-destructive">
                      ({rubric.criticalCount} critical)
                    </span>
                  )}
                </span>
              ) : status === 'SCANNING' ? (
                <span>{AUDIT_PROGRESS.submitLoading}</span>
              ) : (
                <span>No Flags</span>
              )}
            </div>
          </Card>
        )
      })}
    </div>
  )
}
