'use client'

import { REPORT_COPY } from '@/lib/marketing/copy'
import { rubricIcon } from '@/lib/rubric-icons'
import { rubricLabel } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { RubricName } from '@/lib/audit/constants'

interface Props {
  rubrics: Array<{
    name: RubricName
    flagCount: number
    criticalCount: number
  }>
  firstCriticalIds: Partial<Record<RubricName, string>>
  loading?: boolean
  reportHref?: string
}

export function RubricBar({
  rubrics,
  firstCriticalIds,
  loading = false,
  reportHref = '',
}: Props) {
  return (
    <div className="grid min-w-0 grid-cols-1 sm:grid-cols-3">
      {rubrics.map((rubric) => {
        const Icon = rubricIcon(rubric.name)
        const label = rubricLabel(rubric.name)
        const firstCriticalId = firstCriticalIds[rubric.name]
        const href =
          rubric.criticalCount > 0 && firstCriticalId
            ? `${reportHref}?rubric=${rubric.name}&severity=CRITICAL&flag=${encodeURIComponent(firstCriticalId)}#report-flags`
            : `${reportHref}?rubric=${rubric.name}#report-flags`

        return (
          <a
            key={rubric.name}
            href={href}
            aria-label={REPORT_COPY.workspace.showRubricFlags(
              label,
              rubric.criticalCount
            )}
            className={cn(
              'group flex min-h-16 min-w-0 items-center gap-3 border-t border-border/35 px-3 py-2 first:border-t-0 sm:border-l sm:border-t-0 sm:first:border-l-0 sm:px-4',
              'transition-colors duration-150 hover:bg-accent/45 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
            )}
          >
            <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
            <span className="min-w-0">
              <span className="block truncate text-xs font-medium text-foreground">
                {label}
              </span>
              <span className="mt-0.5 block text-2xs tabular-nums text-muted-foreground">
                {loading
                  ? REPORT_COPY.reportFirst.checkingLabel
                  : REPORT_COPY.workspace.rubricFlagCount(
                      rubric.flagCount,
                      rubric.criticalCount
                    )}
              </span>
            </span>
          </a>
        )
      })}
    </div>
  )
}
