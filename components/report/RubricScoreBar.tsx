'use client'

import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { rubricIcon, rubricTint } from '@/lib/rubric-icons'
import { cn } from '@/lib/utils'

export function RubricScoreBar({
  name,
  score,
  compact = false,
}: {
  name: string
  score: number | null
  compact?: boolean
}) {
  const scoreLabel = score == null ? 'N/A' : String(score)
  const barWidth = score == null ? 0 : Math.min(100, score)
  const Icon = rubricIcon(name)
  const tint = rubricTint(name)

  return (
    <div
      className={cn(
        'w-full rounded-md bg-muted/30 shadow-sm',
        compact ? 'px-2 py-1.5' : 'px-3 py-2.5'
      )}
    >
      <div className="flex items-baseline justify-between gap-1">
        <span
          className={cn(
            'flex min-w-0 items-center gap-1.5 font-medium text-muted-foreground',
            compact ? 'text-3xs leading-tight' : 'text-xs'
          )}
        >
          {Icon ? (
            <Icon
              className={cn('shrink-0', tint, compact ? 'h-3 w-3' : 'h-3.5 w-3.5')}
              aria-hidden
            />
          ) : null}
          <span className="truncate">{name}</span>
        </span>
        <span
          className={cn(
            'shrink-0 font-mono font-bold tabular-nums',
            compact ? 'text-xs' : 'text-sm'
          )}
        >
          {scoreLabel}
        </span>
      </div>
      <div className={cn('overflow-hidden rounded-full bg-muted/50', compact ? 'mt-1 h-0.5' : 'mt-1.5 h-1')}>
        <div
          className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500"
          style={{
            width: `${barWidth}%`,
            backgroundColor: score != null ? scoreToScanColor(score) : undefined,
          }}
        />
      </div>
    </div>
  )
}
