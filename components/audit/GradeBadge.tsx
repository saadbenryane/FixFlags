import { cn, gradeColor } from '@/lib/utils'

interface Props {
  grade: string | null
  score?: number | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function GradeBadge({ grade, score, size = 'md', className }: Props) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-sm',
    md: 'px-2.5 py-1 text-xl',
    lg: 'px-3 py-1.5 text-2xl',
  }

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
      {score != null && size !== 'sm' && (
        <div className="text-xs mt-0.5 font-medium tabular-nums">{score}</div>
      )}
    </div>
  )
}
