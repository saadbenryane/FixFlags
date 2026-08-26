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
  sectionId?: string
}

export function LaunchGates({ checklist, sectionId = 'product-launch-gates' }: Props) {
  if (checklist.length === 0) return null

  const ordered = LAUNCH_CHECKLIST_IDS.map((id) => checklist.find((item) => item.id === id)).filter(
    (item): item is LaunchChecklistItem => item != null
  )
  const items = ordered.length > 0 ? ordered : checklist

  return (
    <Card
      id={sectionId}
      className="scroll-mt-[var(--header-offset)] space-y-3 p-4"
      aria-labelledby="launch-gates-heading"
    >
      <div>
        <SectionTitle id="launch-gates-heading">{REPORT_COPY.launchGates.title}</SectionTitle>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{REPORT_COPY.launchGates.body}</p>
      </div>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.id} className="min-w-0">
            <Surface
              variant="flat"
              className={cn(
                'flex max-w-full min-w-0 items-start gap-2 text-sm',
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
              <span className="min-w-0 [overflow-wrap:anywhere]">{item.label}</span>
            </Surface>
          </li>
        ))}
      </ul>
    </Card>
  )
}
