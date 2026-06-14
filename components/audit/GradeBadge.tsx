import { cn, gradeColor, scoreTypeLabel } from '@/lib/utils'

const OBJECTIVE_AREAS = new Set(['PERFORMANCE', 'ACCESSIBILITY', 'SEO', 'MOBILE'])

interface Props {
  grade: string | null
  score?: number | null
  size?: 'sm' | 'md' | 'lg'
  areaName?: string
  className?: string
}

export function GradeBadge({ grade, score, size = 'md', areaName, className }: Props) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-2.5 py-1 text-xl',
    lg: 'px-3 py-1.5 text-2xl',
  }

  const typeInfo = areaName ? scoreTypeLabel(areaName) : null
  const showNumericScore = score != null && size !== 'sm' && (!areaName || OBJECTIVE_AREAS.has(areaName))

  return (
    <div
      className={cn(
        'rounded-md border text-center shrink-0 font-bold leading-none',
        grade ? gradeColor(grade) : 'text-muted-foreground bg-muted border-border',
        sizeClasses[size],
        className
      )}
    >
      <div>{grade ?? '—'}</div>
      {showNumericScore && (
        <div className="text-xs mt-0.5 font-medium tabular-nums">{score}</div>
      )}
      {typeInfo && size === 'sm' && (
        <div className="text-[8px] mt-0.5 font-normal text-muted-foreground">{typeInfo.label}</div>
      )}
    </div>
  )
}
