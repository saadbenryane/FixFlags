import { cn, gradeColor } from '@/lib/utils'

interface Props {
  grade: string | null
  score?: number | null
  size?: 'sm' | 'md' | 'lg'
  areaName?: string
  className?: string
}

/** Compact inline grade pill, use ScoreCard for marketing/report score layouts. */
export function GradeBadge({ grade, score, size = 'md', className }: Props) {
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-sm min-w-[2rem]',
    md: 'px-2.5 py-1 text-xl min-w-[2.5rem]',
    lg: 'px-3 py-1.5 text-2xl min-w-[3rem]',
  }

  return (
    <div
      className={cn(
        'inline-flex flex-col items-center justify-center rounded-md border text-center shrink-0 font-bold leading-none',
        grade ? gradeColor(grade) : 'text-muted-foreground bg-muted border-border',
        sizeClasses[size],
        className
      )}
    >
      <span>{grade ?? '-'}</span>
      {score != null && size !== 'sm' && (
        <span className="mt-0.5 text-xs font-medium tabular-nums">{score}</span>
      )}
    </div>
  )
}
