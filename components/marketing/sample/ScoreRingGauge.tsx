'use client'

import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

type ScoreRingGaugeSize = 'sm' | 'md' | 'lg'

interface ScoreRingGaugeProps {
  score: number | null
  size?: ScoreRingGaugeSize
  className?: string
}

const SIZE_CONFIG: Record<
  ScoreRingGaugeSize,
  { box: number; radius: number; stroke: number; scoreText: string }
> = {
  sm: { box: 68, radius: 28, stroke: 2.5, scoreText: 'text-xl' },
  md: { box: 88, radius: 36, stroke: 3, scoreText: 'text-3xl' },
  lg: { box: 104, radius: 42, stroke: 3.5, scoreText: 'text-4xl' },
}

/**
 * Sleek score ring — thin stroke, single score color. Arc starts at bottom, fills clockwise.
 */
export function ScoreRingGauge({ score, size = 'md', className }: ScoreRingGaugeProps) {
  const { box, radius, stroke, scoreText } = SIZE_CONFIG[size]
  const center = box / 2
  const circumference = 2 * Math.PI * radius
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, score))
  const filled = circumference * (normalized / 100)
  const gap = circumference - filled
  const fillColor = score != null ? scoreToScanColor(score) : undefined
  const trackColor = 'hsl(var(--muted-foreground) / 0.18)'

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={score == null ? 'Score unavailable' : `Score ${score} percent`}
    >
      <svg width={box} height={box} className="block" aria-hidden>
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {score != null && fillColor && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={fillColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${gap}`}
            strokeDashoffset={0}
            transform={`rotate(90 ${center} ${center})`}
            className="motion-safe:transition-[stroke-dasharray,stroke] motion-safe:duration-700 motion-safe:ease-out"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {score == null ? (
          <span className={cn('font-mono font-bold tabular-nums text-muted-foreground', scoreText)}>
            —
          </span>
        ) : (
          <span
            className={cn(
              'font-mono font-bold tabular-nums leading-none tracking-tight text-foreground',
              scoreText
            )}
          >
            {score}
          </span>
        )}
      </div>
    </div>
  )
}
