import { cn, rubricLabel, shareStatusLabel } from '@/lib/utils'
import { RUBRIC_ORDER } from '@/lib/audit/constants'
import { ArrowRight } from 'lucide-react'
import type { RubricComputed } from '@/lib/audit/rubric'

interface Props {
  beforeShareStatus: string
  afterShareStatus: string
  beforeRubrics: RubricComputed[]
  afterRubrics: RubricComputed[]
}

function statusBadge(status: string): string {
  switch (status) {
    case 'good_to_share':
    case 'PASS':
      return 'bg-grade-A/15 text-grade-A border-grade-A/30'
    case 'fix_before_sharing':
    case 'NEEDS_ATTENTION':
      return 'bg-grade-C/15 text-grade-C border-grade-C/30'
    case 'BLOCKED':
      return 'bg-destructive/15 text-destructive border-destructive/30'
    default:
      return 'text-muted-foreground border-border'
  }
}

export function RubricDiff({
  beforeShareStatus,
  afterShareStatus,
  beforeRubrics,
  afterRubrics,
}: Props) {
  return (
    <div className="rounded-card border-0 bg-card p-4 space-y-4 shadow-card">
      <h2 className="text-sm font-semibold tracking-heading">Rubric comparison</h2>

      <div className="flex items-center gap-4 flex-wrap">
        <span
          className={cn(
            'rounded-lg border px-3 py-1 text-sm font-medium',
            statusBadge(beforeShareStatus)
          )}
        >
          {shareStatusLabel(beforeShareStatus)}
        </span>
        <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        <span
          className={cn(
            'rounded-lg border px-3 py-1 text-sm font-medium',
            statusBadge(afterShareStatus)
          )}
        >
          {shareStatusLabel(afterShareStatus)}
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {RUBRIC_ORDER.map((name) => {
          const before = beforeRubrics.find((r) => r.name === name)
          const after = afterRubrics.find((r) => r.name === name)
          if (!before && !after) return null
          const improved = before?.status !== after?.status && after?.status === 'PASS'
          const regressed = before?.status !== after?.status && after?.status !== 'PASS'

          return (
            <div
              key={name}
              className={cn(
                'rounded-lg border-0 p-3 space-y-2 shadow-card',
                improved && 'bg-grade-A/5',
                regressed && 'bg-destructive/5'
              )}
            >
              <p className="text-xs font-medium text-muted-foreground">{rubricLabel(name)}</p>
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-semibold',
                    statusBadge(before?.status ?? 'PASS')
                  )}
                >
                  {before?.status ?? 'PASS'}
                </span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span
                  className={cn(
                    'rounded px-1.5 py-0.5 text-xs font-semibold',
                    statusBadge(after?.status ?? 'PASS')
                  )}
                >
                  {after?.status ?? 'PASS'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
