import Link from 'next/link'
import type { Route } from 'next'
import { cn } from '@/lib/utils'
import type { ReportWorkspaceHistoryPoint } from '@/lib/report/workspace-model'
import { CUSTOMER_TERMS } from '@/lib/marketing/copy'

function dateLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date)
}

function pointLabel(point: ReportWorkspaceHistoryPoint, index: number, total: number): string {
  const kind = point.kind === 'watch' ? CUSTOMER_TERMS.watchRun : point.kind === 'update-review' ? CUSTOMER_TERMS.updateReview : CUSTOMER_TERMS.productReviewTitle
  const status = point.status === 'partial' ? 'Partial capture' : point.status === 'degraded' ? 'Degraded capture' : point.status === 'failed' ? 'Failed capture' : 'Completed'
  const score = point.score == null ? 'score unavailable' : `score ${Math.round(point.score)}`
  const fullDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(point.checkedAt)
  return `Review ${index + 1} of ${total}, ${kind}, ${fullDate}, ${status}, ${score}`
}

export function ScoreHistoryChart({ history, currentAuditId, className, isLoading = false }: { history: ReportWorkspaceHistoryPoint[]; currentAuditId?: string | null; className?: string; isLoading?: boolean }) {
  if (history.length === 0 && !isLoading) return <p role="status" aria-label="No score history available" className={cn('text-sm text-muted-foreground', className)}>No observations yet</p>
  return (
    <nav className={cn('min-w-0', className)} aria-label="Review history">
      <p className="mb-1 text-2xs font-medium uppercase tracking-label text-muted-foreground">Review history</p>
      <ol className="flex min-w-max items-start overflow-x-auto pb-1">
        {history.map((point, index) => {
          const score = point.score == null ? '–' : Math.round(point.score)
          const current = point.id === currentAuditId
          return (
            <li key={point.id} className={cn('relative flex w-20 shrink-0 justify-center pt-1', index > 0 && 'before:absolute before:left-0 before:right-1/2 before:top-4 before:h-px before:bg-border', index < history.length - 1 && 'after:absolute after:left-1/2 after:right-0 after:top-4 after:h-px after:bg-border')}>
              <Link href={point.href as Route} aria-current={current ? 'page' : undefined} aria-label={pointLabel(point, index, history.length)} className="relative z-10 flex min-h-11 min-w-11 flex-col items-center rounded-control focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring">
                <span className={cn('grid h-7 w-7 place-items-center rounded-full border bg-card font-mono text-2xs font-semibold tabular-nums', current ? 'border-brand text-brand shadow-sm' : 'border-border text-muted-foreground')}>{score}</span>
                <span className="mt-1 whitespace-nowrap text-3xs text-muted-foreground">{dateLabel(point.checkedAt)}</span>
              </Link>
            </li>
          )
        })}
        {isLoading ? <li className="relative flex w-20 shrink-0 justify-center pt-1 before:absolute before:left-0 before:right-1/2 before:top-4 before:h-px before:bg-border"><span role="status" className="relative z-10 grid h-7 w-7 animate-pulse place-items-center rounded-full border border-brand/40 bg-card font-mono text-xs text-brand" aria-label="Review in progress"><span aria-hidden>…</span><span className="sr-only">Live review in progress</span></span></li> : null}
      </ol>
    </nav>
  )
}
