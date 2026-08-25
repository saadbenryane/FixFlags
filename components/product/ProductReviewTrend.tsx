import Link from 'next/link'
import type { Route } from 'next'
import { ArrowUpRight, ChartNoAxesCombined } from 'lucide-react'
import type { ProductReviewSummaryDTO } from '@/lib/products/workspace'
import { cn } from '@/lib/utils'

const PLOT_HEIGHT = 96
const PLOT_TOP = 12
const PLOT_BOTTOM = 20

function plotY(score: number): number {
  const bounded = Math.max(0, Math.min(100, score))
  return PLOT_TOP + ((100 - bounded) / 100) * (PLOT_HEIGHT - PLOT_TOP - PLOT_BOTTOM)
}

function dateLabel(value: string): string {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function reviewLabel(review: ProductReviewSummaryDTO, index: number, total: number): string {
  const score = review.score == null ? 'score unavailable' : `score ${Math.round(review.score)}`
  return `Open Review ${index + 1} of ${total}, ${dateLabel(review.completedAt || review.createdAt)}, ${score}`
}

export function ProductReviewTrend({
  reviews,
  className,
}: {
  reviews: ProductReviewSummaryDTO[]
  className?: string
}) {
  const completed = reviews
    .filter((review) => review.status === 'COMPLETED' && review.score != null)
    .slice()
    .reverse()
  const pointCount = Math.max(completed.length, 3)
  const positions = Array.from({ length: pointCount }, (_, index) =>
    pointCount === 1 ? 50 : 8 + (index / (pointCount - 1)) * 84,
  )
  const plotted = completed.map((review, index) => ({
    review,
    x: positions[index] ?? 50,
    y: plotY(review.score ?? 0),
  }))
  const linePoints = plotted.map((point) => `${point.x},${point.y}`).join(' ')

  return (
    <section
      aria-labelledby="review-progress-heading"
      className={cn('rounded-card border border-border/45 bg-card/65 p-4 sm:p-5', className)}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined className="h-4 w-4 text-brand" aria-hidden />
            <h3 id="review-progress-heading" className="text-sm font-semibold">
              Score progress
            </h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Each point opens the evidence from that Review.
          </p>
        </div>
        {completed.length > 1 ? (
          <p className="font-mono text-xs tabular-nums text-muted-foreground">
            {Math.round(completed[0]?.score ?? 0)} → {Math.round(completed.at(-1)?.score ?? 0)}
          </p>
        ) : null}
      </div>

      <div className="relative mt-4 h-28 overflow-hidden" aria-label="Review score trend">
        <svg
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-24 w-full overflow-visible"
          viewBox={`0 0 100 ${PLOT_HEIGHT}`}
          preserveAspectRatio="none"
        >
          {[25, 50, 75].map((score) => (
            <line
              key={score}
              x1="0"
              x2="100"
              y1={plotY(score)}
              y2={plotY(score)}
              vectorEffect="non-scaling-stroke"
              className="stroke-border/55"
              strokeDasharray="3 5"
            />
          ))}
          {linePoints ? (
            <polyline
              points={linePoints}
              fill="none"
              vectorEffect="non-scaling-stroke"
              className="stroke-brand"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {completed.length < 2 ? (
            <line
              x1={completed.length === 1 ? positions[0] : positions[0]}
              x2={positions.at(-1)}
              y1={completed.length === 1 ? plotted[0]?.y : plotY(50)}
              y2={completed.length === 1 ? plotted[0]?.y : plotY(50)}
              vectorEffect="non-scaling-stroke"
              className="stroke-brand/30"
              strokeWidth="2"
              strokeDasharray="4 5"
            />
          ) : null}
          {positions.slice(completed.length).map((x, index) => (
            <circle
              key={`future-${index}`}
              cx={x}
              cy={completed.length === 1 ? plotted[0]?.y : plotY(50)}
              r="2.2"
              vectorEffect="non-scaling-stroke"
              className="fill-card stroke-brand/35"
              strokeWidth="1.5"
              strokeDasharray="2 2"
            />
          ))}
        </svg>

        {plotted.map(({ review, x, y }, index) => (
          <Link
            key={review.id}
            href={`/report/${review.id}?view=report` as Route}
            aria-label={reviewLabel(review, index, completed.length)}
            className="group absolute z-10 grid h-11 w-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            style={{ left: `${x}%`, top: `${y}px` }}
          >
            <span className="grid h-7 w-7 place-items-center rounded-full border-2 border-brand bg-card font-mono text-2xs font-semibold tabular-nums text-brand shadow-sm transition-transform group-hover:scale-110">
              {Math.round(review.score ?? 0)}
            </span>
          </Link>
        ))}

        {completed.length === 0 ? (
          <p className="absolute inset-x-0 bottom-0 text-center text-xs text-muted-foreground">
            Your score trend will appear after the first completed Review.
          </p>
        ) : completed.length === 1 ? (
          <p className="absolute bottom-0 right-0 text-xs text-muted-foreground">
            Future Reviews appear here
          </p>
        ) : (
          <div className="absolute inset-x-0 bottom-0 flex justify-between text-2xs text-muted-foreground">
            <span>{dateLabel(completed[0]?.completedAt || completed[0]?.createdAt || '')}</span>
            <span className="inline-flex items-center gap-1 font-medium text-link">
              Open any point <ArrowUpRight className="h-3 w-3" aria-hidden />
            </span>
            <span>{dateLabel(completed.at(-1)?.completedAt || completed.at(-1)?.createdAt || '')}</span>
          </div>
        )}
      </div>
    </section>
  )
}
