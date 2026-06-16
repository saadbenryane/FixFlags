'use client'

import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { rubricLabel, rubricDescription, rubricStatusColor, cn } from '@/lib/utils'
import { RubricStatusBadge } from '@/components/audit/RubricStatusBadge'
import type { RubricComputed } from '@/lib/audit/rubric'

interface RubricData extends RubricComputed {
  label: string
  description: string
}

interface Props {
  rubrics: RubricComputed[]
}

export function RubricSummaryGrid({ rubrics }: Props) {
  const ordered: RubricData[] = RUBRIC_ORDER.map((name) => {
    const r = rubrics.find((r) => r.name === name)
    return {
      name,
      status: r?.status ?? 'NEEDS_ATTENTION',
      flagCount: r?.flagCount ?? 0,
      criticalCount: r?.criticalCount ?? 0,
      importantCount: r?.importantCount ?? 0,
      label: rubricLabel(name),
      description: rubricDescription(name),
    }
  })

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {ordered.map((rubric) => (
        <button
          key={rubric.name}
          type="button"
          onClick={() => {
            const el = document.getElementById(`rubric-${rubric.name}`)
            if (el) {
              window.history.replaceState(null, '', `#rubric-${rubric.name}`)
              el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          }}
          className={cn(
            'rounded-card border-0 p-4 text-left shadow-card transition-shadow duration-200 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring',
            rubricStatusColor(rubric.status)
          )}
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <h3 className="text-sm font-semibold">{rubric.label}</h3>
            <RubricStatusBadge status={rubric.status} size="sm" />
          </div>
          <p className="text-xs text-muted-foreground leading-snug text-pretty mb-3">
            {rubric.description}
          </p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {rubric.flagCount > 0 ? (
              <span>
                {rubric.flagCount} Flag{rubric.flagCount !== 1 ? 's' : ''}
                {rubric.criticalCount > 0 && (
                  <span className="text-destructive font-medium ml-1">
                    ({rubric.criticalCount} critical)
                  </span>
                )}
              </span>
            ) : (
              <span>No Flags</span>
            )}
          </div>
        </button>
      ))}
    </div>
  )
}
