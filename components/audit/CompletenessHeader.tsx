import { CheckCircle2, XCircle } from 'lucide-react'

interface CompletenessHeaderProps {
  hasScreenshots: boolean
  areasGradedCount: number
  totalAreas: number
  hasFixPrompts: boolean
  canRecheck: boolean
}

export function CompletenessHeader({
  hasScreenshots,
  areasGradedCount,
  totalAreas,
  hasFixPrompts,
  canRecheck,
}: CompletenessHeaderProps) {
  const items = [
    { label: 'Evidence screenshots', passed: hasScreenshots },
    { label: `${areasGradedCount}/${totalAreas} areas graded`, passed: areasGradedCount > 0 },
    { label: 'Fix prompts', passed: hasFixPrompts },
    { label: 'Re-check ready', passed: canRecheck },
  ]

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3" role="status" aria-label="Report completeness">
      <p className="font-mono text-[10px] uppercase tracking-label text-muted-foreground">
        Report completeness
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((item) => (
          <div key={item.label} className="flex items-center gap-2 text-sm">
            {item.passed ? (
              <CheckCircle2 className="h-4 w-4 text-grade-A shrink-0" />
            ) : (
              <XCircle className="h-4 w-4 text-destructive shrink-0" />
            )}
            <span className={item.passed ? 'text-foreground/90' : 'text-muted-foreground'}>
              {item.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
