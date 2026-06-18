'use client'

import { useId } from 'react'
import { cn } from '@/lib/utils'

type ScoreRingGaugeSize = 'sm' | 'md' | 'lg'

interface ScoreRingGaugeProps {
  score: number | null
  grade?: string | null
  size?: ScoreRingGaugeSize
  className?: string
  label?: string
}

const SIZE_CONFIG: Record<
  ScoreRingGaugeSize,
  { box: number; radius: number; stroke: number; scoreText: string; subText: string }
> = {
  sm: { box: 88, radius: 36, stroke: 6, scoreText: 'text-2xl', subText: 'text-[9px]' },
  md: { box: 112, radius: 46, stroke: 7, scoreText: 'text-3xl', subText: 'text-[10px]' },
  lg: { box: 128, radius: 52, stroke: 8, scoreText: 'text-4xl', subText: 'text-xs' },
}

/**
 * PageSpeed-style ring: gray empty track, filled arc uses red → orange → yellow → green
 * along the 0→100 path (only the scored portion is visible).
 */
export function ScoreRingGauge({
  score,
  grade,
  size = 'md',
  className,
  label,
}: ScoreRingGaugeProps) {
  const uid = useId().replace(/:/g, '')
  const arcGradientId = `score-arc-gradient-${uid}`
  const { box, radius, stroke, scoreText, subText } = SIZE_CONFIG[size]
  const center = box / 2
  const circumference = 2 * Math.PI * radius
  const normalized = score == null ? 0 : Math.min(100, Math.max(0, score))
  const offset = circumference - (normalized / 100) * circumference

  return (
    <div
      className={cn('relative inline-flex shrink-0 flex-col items-center', className)}
      role="img"
      aria-label={
        score == null ? 'Score unavailable' : `Score ${score} out of 100${grade ? `, grade ${grade}` : ''}`
      }
    >
      <div className="relative" style={{ width: box, height: box }}>
        <svg
          width={box}
          height={box}
          viewBox={`0 0 ${box} ${box}`}
          className="-rotate-90"
          aria-hidden
        >
          <defs>
            {/* Low → high mapped clockwise from top: red, brand orange, yellow, green */}
            <linearGradient
              id={arcGradientId}
              gradientUnits="userSpaceOnUse"
              x1={center - radius}
              y1={center}
              x2={center + radius}
              y2={center}
            >
              <stop offset="0%" stopColor="hsl(var(--destructive))" />
              <stop offset="28%" stopColor="hsl(var(--brand))" />
              <stop offset="58%" stopColor="hsl(var(--warning))" />
              <stop offset="100%" stopColor="hsl(var(--success))" />
            </linearGradient>
          </defs>

          {/* Empty track — neutral gray only */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted-foreground) / 0.18)"
            strokeWidth={stroke}
          />

          {/* Scored arc — spectrum only on filled portion */}
          {score != null && (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={`url(#${arcGradientId})`}
              strokeWidth={stroke}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
            />
          )}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {score == null ? (
            <span className={cn('font-mono font-bold tabular-nums text-muted-foreground', scoreText)}>
              —
            </span>
          ) : (
            <>
              <span
                className={cn(
                  'font-mono font-bold tabular-nums leading-none tracking-tight text-foreground',
                  scoreText
                )}
              >
                {score}
              </span>
              <span className={cn('mt-0.5 font-mono text-muted-foreground', subText)}>/ 100</span>
              {grade && (
                <span
                  className={cn(
                    'mt-1 rounded-full bg-muted/60 px-1.5 py-px font-mono font-semibold uppercase text-muted-foreground',
                    subText
                  )}
                >
                  {grade}
                </span>
              )}
            </>
          )}
        </div>
      </div>
      {label && (
        <p className="mt-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground/60">
          {label}
        </p>
      )}
    </div>
  )
}
