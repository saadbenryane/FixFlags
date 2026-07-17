'use client'

import { Globe2, MessageSquare, Zap } from 'lucide-react'
import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

const BAR_META: Record<
  string,
  { icon: typeof MessageSquare; tint: string }
> = {
  Message: { icon: MessageSquare, tint: 'text-brand' },
  Experience: { icon: Zap, tint: 'text-success' },
  Reach: { icon: Globe2, tint: 'text-info' },
}

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
  const meta = BAR_META[name]
  const Icon = meta?.icon

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
              className={cn('shrink-0', meta.tint, compact ? 'h-3 w-3' : 'h-3.5 w-3.5')}
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
          className="h-full rounded-full motion-safe:transition-all motion-safe:duration-500"
          style={{
            width: `${barWidth}%`,
            backgroundColor: score != null ? scoreToScanColor(score) : undefined,
          }}
        />
      </div>
    </div>
  )
}
