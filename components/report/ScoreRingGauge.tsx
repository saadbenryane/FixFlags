'use client'

import { scoreToScanColor } from '@/lib/marketing/scan-score-color'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'
import { AUDIT_PROGRESS } from '@/lib/marketing/copy'
import { cn } from '@/lib/utils'

/**
 * Calm indeterminate scan motion: one slow scale + opacity swell, so the ring
 * reads as breathing rather than spinning. Gated motion-safe so reduced-motion
 * users get a still ring. Colocated like SHIMMER_KEYFRAMES to keep keyframes
 * out of the global Tailwind config.
 */
export const SCAN_BREATHE_KEYFRAMES = `@keyframes ff-scan-breathe {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.045); opacity: 0.88; }
}`

type ScoreRingGaugeSize = 'sm' | 'md'

interface ScoreRingGaugeProps {
  score: number | null
  size?: ScoreRingGaugeSize
  /** Render an indeterminate scanning animation instead of a static "N/A". */
  loading?: boolean
  /**
   * Determinate scan progress (0-100). When provided during loading, the ring
   * fills to this value and grows smoothly instead of breathing
   * indeterminately.
   */
  progress?: number
  /** Override the computed aria-label (e.g. dashboard shell placeholders). */
  ariaLabel?: string
  className?: string
}

const SIZE_CONFIG: Record<
  ScoreRingGaugeSize,
  { box: number; radius: number; stroke: number; scoreText: string }
> = {
  sm: { box: 68, radius: 28, stroke: 2.5, scoreText: 'text-xl' },
  md: { box: 88, radius: 36, stroke: 3, scoreText: 'text-3xl' },
}

export function ScoreRingGauge({ score, size = 'md', loading = false, progress, ariaLabel, className }: ScoreRingGaugeProps) {
  const { box, radius, stroke, scoreText } = SIZE_CONFIG[size]
  const center = box / 2
  const circumference = 2 * Math.PI * radius
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, score))
  const filled = circumference * (normalized / 100)
  const gap = circumference - filled
  const fillColor = score != null ? scoreToScanColor(score) : undefined
  const trackColor = 'hsl(var(--muted-foreground) / 0.18)'
  const isScanning = loading && score == null
  // The QUEUED anchor (5) is not real progress - stay indeterminate (breathing)
  // until the server pushes a real milestone (CAPTURING+).
  const hasRealProgress =
    typeof progress === 'number' && progress > PIPELINE_PROGRESS.QUEUED
  const isDeterminate = isScanning && hasRealProgress
  const breathe = isScanning && !isDeterminate
  const scanNormalized = Math.min(100, Math.max(0, progress ?? 0))
  const scanFilled = circumference * (scanNormalized / 100)

  return (
    <div
      className={cn('relative inline-flex shrink-0', className)}
      style={{ width: box, height: box }}
      role="img"
      aria-label={
        ariaLabel ??
        (isScanning
          ? isDeterminate
            ? AUDIT_PROGRESS.ariaScanningPercent(Math.round(scanNormalized))
            : AUDIT_PROGRESS.ariaScanning
          : score == null
            ? AUDIT_PROGRESS.ariaScoreUnavailable
            : AUDIT_PROGRESS.ariaScore(score))
      }
      aria-busy={isScanning || undefined}
    >
      {breathe ? <style>{SCAN_BREATHE_KEYFRAMES}</style> : null}
      <svg
        width={box}
        height={box}
        className={cn(
          'block origin-center',
          breathe &&
            'motion-safe:animate-[ff-scan-breathe_3.2s_ease-in-out_infinite]'
        )}
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
            className={cn(
              isDeterminate &&
                'motion-safe:transition-[stroke-dasharray] motion-safe:duration-700 motion-safe:ease-out'
            )}
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
          <span
            className={cn(
              'origin-center text-sm font-medium tabular-nums text-muted-foreground',
              breathe &&
                'motion-safe:animate-[ff-scan-breathe_3.2s_ease-in-out_infinite]'
            )}
            aria-hidden
          >
            {isDeterminate ? `${Math.round(scanNormalized)}` : ''}
          </span>
        ) : score == null ? (
          <span className={cn('font-mono text-xs font-bold tabular-nums text-muted-foreground', scoreText)}>
            {AUDIT_PROGRESS.scoreNa}
          </span>
        ) : (
          <span
            className={cn(
              'font-mono font-bold tabular-nums leading-none tracking-display text-foreground',
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
