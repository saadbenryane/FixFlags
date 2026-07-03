import { CheckCircle2, XCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'

interface CompletenessHeaderProps {
  hasScreenshots: boolean
  rubricsGradedCount: number
  totalRubrics: number
  hasFixPrompts: boolean
  canMonitor: boolean
}

export function CompletenessHeader({
  hasScreenshots,
  rubricsGradedCount,
  totalRubrics,
  hasFixPrompts,
  canMonitor,
}: CompletenessHeaderProps) {
  const items = [
    { label: 'Evidence screenshots', passed: hasScreenshots },
    {
      label: `${rubricsGradedCount}/${totalRubrics} rubrics graded`,
      passed: rubricsGradedCount > 0,
    },
    { label: 'Fix prompts', passed: hasFixPrompts },
    { label: 'Monitoring ready', passed: canMonitor },
  ]

  return (
    <Card className="space-y-3 p-4" role="status" aria-label="Report completeness">
      <p className="meta-label text-muted-foreground">
        Report completeness
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            {item.passed ? (
              <CheckCircle2 className="h-4 w-4 shrink-0 text-grade-A" />
            ) : (
              <XCircle className="h-4 w-4 shrink-0 text-destructive" />
            )}
            <span className={item.passed ? 'text-foreground/90' : 'text-muted-foreground'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <p className="border-t border-border/15 pt-3 text-xs text-muted-foreground text-pretty">
        <span className="font-medium text-foreground/80">Prompt quality guarantee: </span>
        Evidence-backed selectors only, no guessed file paths. Every prompt includes viewport
        context and verification steps.
      </p>
    </Card>
  )
}
