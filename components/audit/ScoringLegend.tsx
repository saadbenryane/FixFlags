import { cn } from '@/lib/utils'

interface ScoringLegendProps {
  className?: string
  compact?: boolean
}

export function ScoringLegend({ className, compact }: ScoringLegendProps) {
  return (
    <p
      className={cn(
        'text-muted-foreground text-pretty',
        compact ? 'text-xs' : 'text-sm',
        className
      )}
    >
      <span className="font-medium text-foreground/80">QualityOS standard: </span>
      Performance, SEO, Mobile, and Accessibility use 0–100 plus a letter grade. Conversion,
      Trust, and Content use A–F experience grades only.
    </p>
  )
}
