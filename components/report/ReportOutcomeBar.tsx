import type { ReactNode } from 'react'
import { CircleAlert } from 'lucide-react'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import { SHIMMER_KEYFRAMES } from '@/components/ui/skeleton'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type {
  ReportWorkspaceHistoryPoint,
  ReportWorkspaceModel,
} from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

/**
 * Row A of the Report pane: the single place the review states its outcome.
 * Score ring + sparklines, critical badge, and verdict live here once.
 * Unresolved count and rubric counts belong to the explorer filters.
 */
export function ReportOutcomeBar({
  model,
  verdict,
  reportHref = '',
  historyOverride,
  selectedIndex,
  onSelect,
  scanProgress,
  stageDetail,
  actions,
  className,
}: {
  model: ReportWorkspaceModel
  verdict?: string | null
  reportHref?: string
  historyOverride?: ReportWorkspaceHistoryPoint[]
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  scanProgress?: number
  stageDetail?: string | null
  actions?: ReactNode
  className?: string
}) {
  const loading = model.context.loading
  const history: ReportWorkspaceHistoryPoint[] =
    historyOverride ?? model.summary.history ?? []
  const showHistory = history.length > 1
  const firstCritical = model.explorer.flags.find((flag) => flag.severity === 'CRITICAL')
  const criticalHref = firstCritical
    ? `${reportHref}?severity=CRITICAL&flag=${encodeURIComponent(firstCritical.id)}#report-flags`
    : undefined

  return (
    <section
      id="report-status"
      aria-label={REPORT_COPY.workspace.summaryLabel}
      className={cn(
        'shrink-0 scroll-mt-[var(--report-chrome-offset)] rounded-card bg-card/70 shadow-card glass-surface',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <ScoreRingGauge
            score={model.summary.score}
            loading={loading}
            progress={loading ? scanProgress : undefined}
            size="sm"
          />
          {showHistory && (
            <ScoreHistoryChart
              history={history}
              className="h-8"
              isLoading={loading}
              selectedIndex={selectedIndex ?? null}
              onSelect={onSelect}
            />
          )}
        </div>

        {model.summary.score == null && loading ? (
          <p className="text-sm font-medium text-muted-foreground">
            {stageDetail ?? REPORT_COPY.reportFirst.checkingLabel}
          </p>
        ) : null}

        {!loading && firstCritical && criticalHref ? (
          <a
            href={criticalHref}
            aria-label={REPORT_COPY.workspace.showCriticalFlags(model.outcome.criticalCount)}
            className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <CircleAlert className="h-3 w-3" aria-hidden />
            {REPORT_COPY.workspace.criticalCount(model.outcome.criticalCount)}
          </a>
        ) : !loading && model.outcome.criticalCount === 0 ? (
          <span
            aria-label={REPORT_COPY.workspace.criticalCount(0)}
            className="text-xs font-medium text-success"
          >
            {REPORT_COPY.workspace.noCriticalFlags}
          </span>
        ) : null}

        {verdict ? (
          <p
            title={verdict}
            className="line-clamp-2 min-w-0 flex-1 border-border/40 text-sm leading-relaxed text-muted-foreground text-pretty @[46rem]/pane:border-l @[46rem]/pane:pl-5"
          >
            {verdict}
          </p>
        ) : null}

        {!loading && model.outcome.unresolvedCount > 0 ? (
          <p className="w-full text-2xs leading-relaxed text-muted-foreground/80 @[46rem]/pane:w-auto @[46rem]/pane:border-l @[46rem]/pane:pl-5">
            {REPORT_COPY.workspace.nextStepHint}
          </p>
        ) : null}

        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </div>

      {loading && typeof scanProgress === 'number' ? (
        <div
          className="border-t border-border/35 px-4 pb-3 pt-2.5"
          role="status"
          aria-label="Scan progress"
          aria-live="polite"
        >
          <style>{SHIMMER_KEYFRAMES}</style>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {stageDetail ?? REPORT_COPY.reportFirst.checkingLabel}
            </span>
            <span className="font-mono tabular-nums">{scanProgress}%</span>
          </div>
          <div className="relative h-0.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
            <div
              className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
              style={{ width: `${Math.min(100, Math.max(0, scanProgress))}%` }}
            />
            <div
              aria-hidden
              className="absolute inset-0 bg-gradient-to-r from-transparent via-brand/25 to-transparent motion-safe:animate-[ff-shimmer_2.4s_linear_infinite]"
            />
          </div>
        </div>
      ) : null}
    </section>
  )
}
