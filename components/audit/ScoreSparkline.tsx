import { useId } from 'react'
import { GRADE_THRESHOLDS } from '@/lib/audit/rubric'

interface ScoreSparklineProps {
  scores: number[]
  width?: number
  height?: number
  className?: string
}

export function ScoreSparkline({
  scores,
  width = 64,
  height = 24,
  className,
}: ScoreSparklineProps) {
  const gradientId = useId()

  if (scores.length === 0) return null

  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1

  const points = scores
    .map((s, i) => {
      const x = (i / Math.max(scores.length - 1, 1)) * (width - 2) + 1
      const y = height - 2 - ((s - min) / range) * (height - 4)
      return `${x},${y}`
    })
    .join(' ')

  const areaPoints = `1,${height - 1} ${points} ${width - 1},${height - 1}`

  const latest = scores[scores.length - 1]
  const latestColor =
    latest >= GRADE_THRESHOLDS.A
      ? 'hsl(var(--grade-A))'
      : latest >= GRADE_THRESHOLDS.B
        ? 'hsl(var(--grade-B))'
        : latest >= GRADE_THRESHOLDS.C
          ? 'hsl(var(--grade-C))'
          : 'hsl(var(--grade-D))'

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-label={`Score trend: ${scores.join(', ')}`}
      role="img"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={latestColor} stopOpacity="0.2" />
          <stop offset="100%" stopColor={latestColor} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradientId})`} />
      <polyline
        points={points}
        fill="none"
        stroke={latestColor}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={width - 1} cy={height - 2 - ((latest - min) / range) * (height - 4)} r="2" fill={latestColor} />
    </svg>
  )
}
