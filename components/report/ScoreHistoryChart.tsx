import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'

const BAR_WIDTH = 3
const BAR_HEIGHT = 32

function scoreToColor(score: number | null): string {
  if (score === null) return 'hsl(var(--muted-foreground))'
  if (score >= 80) return 'hsl(var(--success))'
  if (score >= 60) return 'hsl(var(--warning))'
  return 'hsl(var(--destructive))'
}

function formatDateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date)
}

function getKindLabel(kind: ReportWorkspaceHistoryPoint['kind']): string {
  switch (kind) {
    case 'product-review':
      return 'Product review'
    case 'update-review':
      return 'Update review'
    case 'watch':
      return 'Watch run'
  }
}

function getStatusLabel(status: ReportWorkspaceHistoryPoint['status']): string {
  switch (status) {
    case 'completed':
      return 'Completed'
    case 'partial':
      return 'Partial capture'
    case 'degraded':
      return 'Degraded capture'
    case 'failed':
      return 'Failed capture'
  }
}

function getHistoryPointLabel(
  point: ReportWorkspaceHistoryPoint,
  index: number,
  total: number,
): string {
  const scoreLabel = point.score === null
    ? 'score unavailable'
    : `score ${Math.round(point.score)}`

  return [
    `Review ${index + 1} of ${total}`,
    getKindLabel(point.kind),
    formatDateLabel(point.checkedAt),
    getStatusLabel(point.status),
    scoreLabel,
  ].join(', ')
}

export function ScoreHistoryChart({
  history,
  currentAuditId,
  className,
  isLoading = false,
}: {
  history: ReportWorkspaceHistoryPoint[]
  currentAuditId?: string | null
  className?: string
  isLoading?: boolean
}) {
  if (history.length === 0 && !isLoading) {
    return (
      <div
        className={cn('py-2 text-center text-muted-foreground', className)}
        role="status"
        aria-label="No score history available"
      >
        No observations yet
      </div>
    )
  }

  return (
    <nav className={cn('min-w-0', className)} aria-label="Review history">
      <ol className="flex max-w-full items-end overflow-x-auto">
        {history.map((point, index) => {
          const isCurrent = point.id === currentAuditId
          const score = point.score
          const label = getHistoryPointLabel(point, index, history.length)

          return (
            <li key={point.id} className="shrink-0">
              <Link
                href={point.href as Route}
                aria-label={label}
                aria-current={isCurrent ? 'page' : undefined}
                title={label}
                className="relative flex min-h-11 min-w-11 items-end justify-center rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring focus-visible:ring-offset-1"
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'rounded-sm transition-[height,opacity,box-shadow] duration-200',
                    isCurrent && 'ring-2 ring-inset ring-foreground/45',
                  )}
                  style={{
                    width: BAR_WIDTH,
                    height: score !== null
                      ? Math.max(4, (Math.min(100, Math.max(0, score)) / 100) * BAR_HEIGHT)
                      : 4,
                    backgroundColor: scoreToColor(score),
                    opacity: score !== null ? (isCurrent ? 1 : 0.72) : 0.45,
                  }}
                />
              </Link>
            </li>
          )
        })}
        {isLoading ? (
          <li className="flex min-h-11 min-w-11 shrink-0 items-end justify-center" aria-hidden="true">
            <span
              className="inline-block w-[3px] rounded-sm bg-foreground/25"
              style={{ height: 16 }}
            />
          </li>
        ) : null}
      </ol>

      {isLoading ? (
        <span className="sr-only" role="status" aria-live="polite">
          Live review in progress
        </span>
      ) : null}
    </nav>
  )
}
