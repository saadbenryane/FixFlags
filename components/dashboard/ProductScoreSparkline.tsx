import type { ProductScorePointDTO } from '@/lib/products/workspace'
import { cn } from '@/lib/utils'

const VIEW_WIDTH = 100
const VIEW_HEIGHT = 32
const PAD_X = 4
const PAD_Y = 4

function plotY(score: number): number {
  const bounded = Math.max(0, Math.min(100, score))
  return PAD_Y + ((100 - bounded) / 100) * (VIEW_HEIGHT - PAD_Y * 2)
}

function plotX(index: number, count: number): number {
  if (count <= 1) return VIEW_WIDTH / 2
  return PAD_X + (index / (count - 1)) * (VIEW_WIDTH - PAD_X * 2)
}

export function ProductScoreSparkline({
  points,
  productId,
  decorative = false,
  className,
}: {
  points: ProductScorePointDTO[]
  productId: string
  decorative?: boolean
  className?: string
}) {
  const gradientId = `product-score-fill-${productId}`
  const plotted = points.map((point, index) => ({
    x: plotX(index, points.length),
    y: plotY(point.score),
  }))
  const linePoints = plotted.map((point) => `${point.x},${point.y}`).join(' ')
  const areaPath =
    plotted.length > 0
      ? [
          `M ${plotted[0].x} ${VIEW_HEIGHT - PAD_Y}`,
          ...plotted.map((point) => `L ${point.x} ${point.y}`),
          `L ${plotted.at(-1)?.x ?? PAD_X} ${VIEW_HEIGHT - PAD_Y}`,
          'Z',
        ].join(' ')
      : null
  const first = points[0]?.score
  const last = points.at(-1)?.score
  const label =
    points.length === 0
      ? 'No completed scores yet'
      : points.length === 1
        ? `Score ${Math.round(first ?? 0)}`
        : `Score trend ${Math.round(first ?? 0)} to ${Math.round(last ?? 0)}`

  return (
    <svg
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : label}
      viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
      preserveAspectRatio="none"
      className={cn('h-8 w-full overflow-visible', className)}
    >
      {decorative ? null : <title>{label}</title>}
      <defs>
        <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--brand))" stopOpacity="0.18" />
          <stop offset="100%" stopColor="hsl(var(--brand))" stopOpacity="0" />
        </linearGradient>
      </defs>
      {areaPath ? <path d={areaPath} fill={`url(#${gradientId})`} /> : null}
      {linePoints && points.length > 1 ? (
        <polyline
          points={linePoints}
          fill="none"
          vectorEffect="non-scaling-stroke"
          className="stroke-brand"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {points.length === 1 ? (
        <>
          <line
            x1={PAD_X}
            x2={VIEW_WIDTH - PAD_X}
            y1={plotted[0]?.y}
            y2={plotted[0]?.y}
            vectorEffect="non-scaling-stroke"
            className="stroke-brand/30"
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />
          <circle
            cx={plotted[0]?.x}
            cy={plotted[0]?.y}
            r="2.4"
            className="fill-brand"
          />
        </>
      ) : null}
      {points.length === 0 ? (
        <line
          x1={PAD_X}
          x2={VIEW_WIDTH - PAD_X}
          y1={plotY(50)}
          y2={plotY(50)}
          vectorEffect="non-scaling-stroke"
          className="stroke-border"
          strokeWidth="1.5"
          strokeDasharray="3 4"
        />
      ) : null}
    </svg>
  )
}
