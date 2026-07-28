import { cn, gradeColor } from '@/lib/utils'
import { resolveScoreDisplay } from '@/lib/audit/score-display'

export type ScoreDisplayVariant = 'compact' | 'inline'

interface ScoreDisplayProps {
  rubricName?: string
  label?: string
  grade: string | null
  score?: number | null
  variant?: ScoreDisplayVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const PILL_SIZES = {
  sm: 'px-2 py-0.5 text-sm min-w-[2rem]',
  md: 'px-2.5 py-1 text-xl min-w-[2.5rem]',
  lg: 'px-3 py-1.5 text-2xl min-w-[3rem]',
} as const

function GradePill({
  grade,
  size = 'md',
  className,
}: {
  grade: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  return (
    <div
      className={cn(
        'inline-flex shrink-0 flex-col items-center justify-center rounded-md border text-center font-bold leading-none',
        grade ? gradeColor(grade) : 'border-border bg-muted text-muted-foreground',
        PILL_SIZES[size],
        className
      )}
    >
      <span>{grade ?? '-'}</span>
    </div>
  )
}

export function ScoreDisplay({
  rubricName,
  label,
  grade,
  score = null,
  variant = 'compact',
  size = 'md',
  className,
}: ScoreDisplayProps) {
  const resolved = resolveScoreDisplay({ grade, score })
  void rubricName
  void label

  if (variant === 'compact') {
    return (
      <div
        className={cn(
          'inline-flex min-h-[2.75rem] min-w-[3.25rem] flex-col items-center justify-center rounded-md border text-center font-bold leading-none',
          resolved.grade ? gradeColor(resolved.grade) : 'border-border bg-muted text-muted-foreground',
          size === 'sm' ? 'px-2 py-1 text-sm' : 'px-2.5 py-1.5 text-xl',
          className
        )}
      >
        <span>{resolved.primary}</span>
      </div>
    )
  }

  if (variant === 'inline') {
    if (resolved.mode === 'numeric' && resolved.score != null) {
      return (
        <div className={cn('shrink-0 text-right', className)}>
          <p className="font-mono text-2xl font-bold tabular-nums leading-none text-brand">
            {resolved.primary}
          </p>
          {resolved.grade ? (
            <p className="mt-1 font-mono text-xs text-muted-foreground">{resolved.secondary}</p>
          ) : null}
        </div>
      )
    }

    return (
      <div className={cn('shrink-0 text-right', className)}>
        <GradePill grade={resolved.grade} size={size === 'lg' ? 'lg' : 'sm'} className="ml-auto" />
      </div>
    )
  }
}
