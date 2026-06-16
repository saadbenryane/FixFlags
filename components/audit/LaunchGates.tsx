import { Check, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { SectionTitle } from '@/components/ui/typography'
import { Surface } from '@/components/ui/surface'
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
    <Card
      id="report-launch-gates"
      className="scroll-mt-[var(--header-offset)] space-y-3 p-4"
      aria-labelledby="launch-gates-heading"
    >
      <div>
        <SectionTitle id="launch-gates-heading">{REPORT_COPY.launchGates.title}</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{REPORT_COPY.launchGates.body}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id}>
            <Surface
              variant="flat"
              className={cn(
                'flex items-start gap-2 text-sm',
                item.passed
                  ? 'bg-grade-A/5 text-foreground'
                  : 'bg-grade-F/5 text-foreground'
              )}
            >
              {item.passed ? (
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-grade-A" aria-hidden />
              ) : (
                <X className="mt-0.5 h-4 w-4 shrink-0 text-grade-F" aria-hidden />
              )}
              <span>{item.label}</span>
            </Surface>
          </li>
        ))}
      </ul>
    </Card>
  )
}
