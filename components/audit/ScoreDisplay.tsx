import { cn, areaLabel, gradeColor } from '@/lib/utils'
import { resolveScoreDisplay } from '@/lib/audit/score-display'

export type ScoreDisplayVariant = 'card' | 'compact' | 'hero' | 'inline' | 'pill'

interface ScoreDisplayProps {
  areaName?: string
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
  areaName,
  label,
  grade,
  score = null,
  variant = 'card',
  size = 'md',
  className,
}: ScoreDisplayProps) {
  const resolved = resolveScoreDisplay({ areaName, grade, score })
  const displayLabel = label ?? (areaName ? areaLabel(areaName) : 'Overall')

  if (variant === 'pill') {
    return <GradePill grade={resolved.grade} size={size} className={className} />
  }

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

  if (variant === 'hero') {
    return (
      <div
        className={cn(
          'min-w-[88px] shrink-0 rounded-xl border p-4 text-center',
          resolved.grade ? gradeColor(resolved.grade) : 'border-border bg-muted/50 text-muted-foreground',
          className
        )}
      >
        <div className="font-mono text-4xl font-bold tabular-nums">{resolved.primary}</div>
        <div className="mt-1 font-mono text-xs text-muted-foreground">
          {resolved.score == null
            ? 'Unavailable'
            : `${resolved.caption ?? '/ 100'} · ${resolved.secondary}`}
        </div>
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

  // card variant (default)
  return (
    <div
      className={cn(
        'flex min-h-[4.5rem] items-center gap-4 rounded-card border-0 bg-card p-4 shadow-card',
        size === 'sm' && 'min-h-[3.75rem] gap-3 p-3',
        className
      )}
    >
      <div className="shrink-0 text-left">
        {resolved.mode === 'numeric' && resolved.score != null ? (
          <div className="tabular-nums">
            <div
              className={cn(
                'font-mono font-bold leading-none text-brand',
                size === 'sm' ? 'text-2xl' : 'text-3xl'
              )}
            >
              {resolved.primary}
            </div>
            <div className="mt-0.5 font-mono text-xs text-muted-foreground">{resolved.caption}</div>
          </div>
        ) : (
          <GradePill grade={resolved.grade} size={size === 'sm' ? 'md' : 'lg'} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn('font-medium leading-snug', size === 'sm' ? 'text-xs' : 'text-sm')}>
          {displayLabel}
        </p>
        {resolved.mode === 'numeric' && resolved.secondary ? (
          <p className="mt-0.5 font-mono text-xs text-muted-foreground">{resolved.secondary}</p>
        ) : null}
        {resolved.mode === 'grade' && resolved.caption ? (
          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-label text-muted-foreground">
            {resolved.caption}
          </p>
        ) : null}
      </div>
    </div>
  )
}
