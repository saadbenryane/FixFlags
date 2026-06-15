import { cn, areaLabel, gradeColor } from '@/lib/utils'

const OBJECTIVE_AREAS = new Set(['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE'])

interface ScoreCardProps {
  areaName?: string
  label?: string
  grade: string | null
  score?: number | null
  size?: 'sm' | 'md'
  className?: string
  layout?: 'horizontal' | 'compact'
}

export function ScoreCard({
  areaName,
  label,
  grade,
  score,
  size = 'md',
  className,
  layout = 'horizontal',
}: ScoreCardProps) {
  const displayLabel = label ?? (areaName ? areaLabel(areaName) : 'Overall')
  const isObjective = areaName ? OBJECTIVE_AREAS.has(areaName) : score != null
  const showNumeric = isObjective && score != null

  if (layout === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex min-h-[2.75rem] min-w-[3.25rem] flex-col items-center justify-center rounded-md border text-center font-bold leading-none',
          grade ? gradeColor(grade) : 'border-border bg-muted text-muted-foreground',
          size === 'sm' ? 'px-2 py-1 text-sm' : 'px-2.5 py-1.5 text-xl',
          className
        )}
      >
        <span>{grade ?? '-'}</span>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'flex min-h-[4.5rem] items-center gap-4 rounded-card border-0 bg-card p-4 shadow-card',
        size === 'sm' && 'min-h-[3.75rem] gap-3 p-3',
        className
      )}
    >
      <div className="shrink-0 text-left">
        {showNumeric ? (
          <div className="tabular-nums">
            <div
              className={cn(
                'font-mono font-bold leading-none text-brand',
                size === 'sm' ? 'text-2xl' : 'text-3xl'
              )}
            >
              {score}
            </div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">/ 100</div>
          </div>
        ) : (
          <div
            className={cn(
              'inline-flex min-w-[2.5rem] items-center justify-center rounded-md border px-2 py-1 font-bold leading-none',
              grade ? gradeColor(grade) : 'border-border bg-muted text-muted-foreground',
              size === 'sm' ? 'text-xl' : 'text-2xl'
            )}
          >
            {grade ?? '-'}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium leading-snug', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {displayLabel}
        </p>
        {grade && showNumeric && (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">Grade {grade}</p>
        )}
        {!showNumeric && grade && (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            Experience grade
          </p>
        )}
      </div>
    </div>
  )
}
