'use client'

import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel, rubricDescription, rubricStatusColor, cn } from '@/lib/utils'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import { RubricScoreBar } from '@/components/report/RubricScoreBar'
import { Card } from '@/components/ui/card'
import type { RubricComputed } from '@/lib/audit/rubric'

interface RubricData extends Omit<RubricComputed, 'status'> {
  status: RubricComputed['status'] | 'SCANNING'
  label: string
  description: string
  score: number | null
}

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
}

export function RubricSummaryGrid({ rubrics, rubricRows, loading = false }: Props) {
  const scoreByName = new Map(
    (rubricRows ?? []).map((row) => [row.name, row.score] as const)
  )

  const ordered: RubricData[] = RUBRIC_ORDER.map((name) => {
    const r = rubrics.find((r) => r.name === name)
    const score = scoreByName.get(name) ?? null
    const flagCount = r?.flagCount ?? 0
    const pending = loading && flagCount === 0 && score == null
    return {
      name,
      status: pending ? 'SCANNING' : r?.status ?? 'NEEDS_ATTENTION',
      flagCount,
      criticalCount: r?.criticalCount ?? 0,
      importantCount: r?.importantCount ?? 0,
      label: rubricLabel(name),
      description: rubricDescription(name),
      score,
    }
  })

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ordered.map((rubric) => (
        <Card
          key={rubric.name}
          interactive
          role="button"
          tabIndex={0}
          onClick={() => {
            const el = document.getElementById(`rubric-${rubric.name}`)
            if (el) {
              window.history.replaceState(null, '', `#rubric-${rubric.name}`)
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              const el = document.getElementById(`rubric-${rubric.name}`)
              el?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          className={cn(
            'cursor-pointer p-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            rubricStatusColor(rubric.status)
          )}
        >
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold">{rubric.label}</h3>
            <RubricStatusBadge status={rubric.status} size="sm" />
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
            ) : rubric.status === 'SCANNING' ? (
              <span>Scanning…</span>
            ) : (
              <span>No Flags</span>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
