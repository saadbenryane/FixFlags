import type { LaunchReadinessData } from '@/lib/audit/launch-readiness'
import {
  launchReadinessLabel,
  launchReadinessTone,
} from '@/lib/audit/launch-readiness'
import { cn } from '@/lib/utils'
import { ArrowRight, CheckCircle2, XCircle } from 'lucide-react'

interface Props {
  before: LaunchReadinessData | null
  after: LaunchReadinessData | null
}

export function LaunchReadinessDiff({ before, after }: Props) {
  if (!before && !after) return null

  const beforeItems = new Map(before?.checklist.map((i) => [i.id, i]) ?? [])
  const afterItems = after?.checklist ?? []
  const mergedIds = new Set([
    ...beforeItems.keys(),
    ...afterItems.map((i) => i.id),
  ])

  if (mergedIds.size === 0 && !before && !after) return null

  return (
    <div className="rounded-xl border bg-card p-4 space-y-4">
      <h2 className="text-sm font-semibold">Launch readiness</h2>
      <div className="flex items-center gap-4 flex-wrap">
        {before && (
          <span
            className={cn(
              'rounded-lg border px-3 py-1 text-sm font-medium',
              launchReadinessTone(before.readiness)
            )}
          >
            {launchReadinessLabel(before.readiness)}
          </span>
        )}
        {before && after && (
          <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden />
        )}
        {after && (
          <span
            className={cn(
              'rounded-lg border px-3 py-1 text-sm font-medium',
              launchReadinessTone(after.readiness)
            )}
          >
            {launchReadinessLabel(after.readiness)}
          </span>
        )}
      </div>
      {mergedIds.size > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {[...mergedIds].map((id) => {
            const b = beforeItems.get(id)
            const a = afterItems.find((i) => i.id === id)
            const label = a?.label ?? b?.label ?? id
            const passedBefore = b?.passed
            const passedAfter = a?.passed
            const improved = passedBefore === false && passedAfter === true
            const regressed = passedBefore === true && passedAfter === false

            return (
              <li
                key={id}
                className={cn(
                  'flex items-start gap-2 text-sm rounded-md px-2 py-1',
                  improved && 'bg-grade-A/10',
                  regressed && 'bg-destructive/10'
                )}
              >
                {passedAfter ? (
                  <CheckCircle2 className="h-4 w-4 text-grade-A shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                )}
                <span>{label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
