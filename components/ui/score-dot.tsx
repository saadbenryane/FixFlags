import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

interface ScoreDotProps {
  score: number | null
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

export function ScoreDot({ score, size = 'md', className, 'aria-label': ariaLabel }: ScoreDotProps) {
  const color = score != null ? scoreToScanColor(score) : 'hsl(var(--muted-foreground))'
  const sizeClasses = size === 'sm' ? 'h-2 w-2' : 'h-2.5 w-2.5'

  return (
    <span
      className={cn(
        'shrink-0 rounded-full shadow-[0_0_0_3px_currentColor]',
        sizeClasses,
        className
      )}
      style={{ color, backgroundColor: color, opacity: 0.9 }}
      aria-hidden={!ariaLabel}
      aria-label={ariaLabel}
      role={ariaLabel ? 'img' : undefined}
    />
  )
}
