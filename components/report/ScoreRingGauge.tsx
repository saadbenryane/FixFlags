'use client'

import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { cn } from '@/lib/utils'

type ScoreRingGaugeSize = 'sm' | 'md' | 'lg'

interface ScoreRingGaugeProps {
  score: number | null
  size?: ScoreRingGaugeSize
  /** Render an indeterminate scanning animation instead of a static "N/A". */
  loading?: boolean
  /**
   * Determinate scan progress (0-100). When provided during loading, the ring
   * fills to this value and grows smoothly instead of spinning indeterminately.
   */
  progress?: number
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

export function ScoreRingGauge({ score, size = 'md', loading = false, progress, className }: ScoreRingGaugeProps) {
  const { box, radius, stroke, scoreText } = SIZE_CONFIG[size]
  const center = box / 2
  const circumference = 2 * Math.PI * radius
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, score))
  const filled = circumference * (normalized / 100)
  const gap = circumference - filled
  const fillColor = score != null ? scoreToScanColor(score) : undefined
  const trackColor = 'hsl(var(--muted-foreground) / 0.18)'
  const isScanning = loading && score == null
  // When a real progress value is available, show a determinate arc that grows;
  // otherwise fall back to the indeterminate spinning arc.
  const isDeterminate = isScanning && typeof progress === 'number'
  const scanNormalized = Math.min(100, Math.max(0, progress ?? 0))
  const scanFilled = circumference * (scanNormalized / 100)

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={
        isScanning
          ? isDeterminate
            ? `Scanning, ${Math.round(scanNormalized)} percent`
            : 'Scanning'
          : score == null
            ? 'Score unavailable'
            : `Score ${score} percent`
      }
      aria-busy={isScanning || undefined}
    >
      <svg
        width={box}
        height={box}
        className={cn('block', isScanning && !isDeterminate && 'origin-center motion-safe:animate-spin')}
        aria-hidden
      >
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={stroke}
        />
        {isScanning && (
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--brand))"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={
              isDeterminate
                ? `${scanFilled} ${circumference - scanFilled}`
                : `${circumference * 0.25} ${circumference * 0.75}`
            }
            transform={`rotate(-90 ${center} ${center})`}
            className={cn(isDeterminate && 'motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out')}
          />
        )}
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
            transform={`rotate(-90 ${center} ${center})`}
            className="motion-safe:transition-[stroke-dasharray,stroke] motion-safe:duration-700 motion-safe:ease-out"
          />
        )}
      </svg>

      <div className="absolute inset-0 flex items-center justify-center">
        {isScanning ? (
          <span className="flex gap-1" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 motion-safe:animate-pulse" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 motion-safe:animate-pulse [animation-delay:150ms]" />
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 motion-safe:animate-pulse [animation-delay:300ms]" />
          </span>
        ) : score == null ? (
          <span className={cn('font-mono text-xs font-bold tabular-nums text-muted-foreground', scoreText)}>
            N/A
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
