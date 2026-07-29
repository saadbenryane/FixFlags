import { useId } from 'react'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'

export function ScoreHistoryChart({
  history,
  className,
}: {
  history: ReportWorkspaceHistoryPoint[]
  className?: string
}) {
  const gradientId = useId()
  if (history.length === 0) return null

  const width = 360
  const height = 104
  const chartTop = 10
  const chartBottom = 78
  const chartLeft = 8
  const chartRight = 352
  const scores = history.map((point) => point.score)
  const min = Math.max(0, Math.min(...scores) - 8)
  const max = Math.min(100, Math.max(...scores) + 8)
  const range = Math.max(1, max - min)
  const points = history.map((point, index) => {
    const x =
      history.length === 1
        ? (chartLeft + chartRight) / 2
        : chartLeft +
          (index / Math.max(history.length - 1, 1)) * (chartRight - chartLeft)
    const y =
      chartBottom -
      ((point.score - min) / range) * (chartBottom - chartTop)
    return { ...point, x, y }
  })
  const pointString = points.map((point) => `${point.x},${point.y}`).join(' ')
  const areaString = `${chartLeft},${chartBottom} ${pointString} ${chartRight},${chartBottom}`
  const first = history[0]
  const last = history.at(-1)
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
  })

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      role="img"
      aria-label={`Release score over ${history.length} scans: ${scores.join(', ')}`}
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[chartTop, (chartTop + chartBottom) / 2, chartBottom].map((y) => (
        <line
          key={y}
          x1={chartLeft}
          x2={chartRight}
          y1={y}
          y2={y}
          stroke="hsl(var(--border))"
          strokeWidth="1"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      <polygon points={areaString} fill={`url(#${gradientId})`} />
      <polyline
        points={pointString}
        fill="none"
        stroke="hsl(var(--brand))"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {points.map((point, index) => (
        <circle
          key={point.id}
          cx={point.x}
          cy={point.y}
          r={index === points.length - 1 ? 3.5 : 2}
          fill={index === points.length - 1 ? 'hsl(var(--brand))' : 'hsl(var(--background))'}
          stroke="hsl(var(--brand))"
          strokeWidth="1.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {first ? (
        <text
          x={chartLeft}
          y="101"
          fill="hsl(var(--muted-foreground))"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          {formatter.format(first.checkedAt)}
        </text>
      ) : null}
      {last ? (
        <text
          x={chartRight}
          y="101"
          textAnchor="end"
          fill="hsl(var(--muted-foreground))"
          fontSize="9"
          fontFamily="var(--font-mono)"
        >
          {formatter.format(last.checkedAt)}
        </text>
      ) : null}
    </svg>
  )
}
