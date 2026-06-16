import { Check, X } from 'lucide-react'
import { LAUNCH_CHECKLIST_IDS } from '@/lib/audit/rubric'
import type { LaunchChecklistItem } from '@/lib/audit/launch-readiness'
import { cn } from '@/lib/utils'
import { REPORT_COPY } from '@/lib/marketing/copy'

interface Props {
  checklist: LaunchChecklistItem[]
}

export function LaunchGates({ checklist }: Props) {
  if (checklist.length === 0) return null

  const ordered = LAUNCH_CHECKLIST_IDS.map((id) => checklist.find((item) => item.id === id)).filter(
    (item): item is LaunchChecklistItem => item != null
  )
  const items = ordered.length > 0 ? ordered : checklist

  return (
    <section
      id="report-launch-gates"
      className="scroll-mt-[var(--header-offset)] rounded-card border-0 bg-card p-4 shadow-card space-y-3"
      aria-labelledby="launch-gates-heading"
    >
      <div>
        <h2 id="launch-gates-heading" className="text-sm font-semibold tracking-heading">
          {REPORT_COPY.launchGates.title}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{REPORT_COPY.launchGates.body}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li
            key={item.id}
            className={cn(
              'flex items-start gap-2 rounded-lg border px-3 py-2 text-sm',
              item.passed
                ? 'border-grade-A/25 bg-grade-A/5 text-foreground'
                : 'border-grade-F/25 bg-grade-F/5 text-foreground'
            )}
          >
            {item.passed ? (
              <Check className="h-4 w-4 shrink-0 text-grade-A mt-0.5" aria-hidden />
            ) : (
              <X className="h-4 w-4 shrink-0 text-grade-F mt-0.5" aria-hidden />
            )}
            <span>{item.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
