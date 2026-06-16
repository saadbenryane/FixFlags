import { cn } from '@/lib/utils'
import { BRAND } from '@/lib/marketing/copy'

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
      <span className="font-medium text-foreground/80">{BRAND.name} rubrics: </span>
      Message, Experience, and Reach each get a letter grade (A–F) based on Flags found and
      evidence quality.
    </p>
  )
}
