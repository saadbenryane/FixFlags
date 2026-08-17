import type { ReactNode } from 'react'
import { CircleAlert, Flag } from 'lucide-react'
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
 * The score, the unresolved count, and the verdict live here once; rubric
 * counts belong to the explorer filters, so the bar never repeats them.
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
  /** Human verdict line for the current observation. */
  verdict?: string | null
  reportHref?: string
  /** Product spine history shown instead of the model's own history. */
  historyOverride?: ReportWorkspaceHistoryPoint[]
  selectedIndex?: number | null
  onSelect?: (index: number) => void
  /** Determinate scan progress (0-100) while the review runs. */
  scanProgress?: number
  /** Honest stage detail shown next to the ring during a scan. */
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
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <ScoreRingGauge
            score={model.summary.score}
            loading={loading}
            progress={loading ? scanProgress : undefined}
            size="sm"
          />
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
              {REPORT_COPY.workspace.releaseScore}
            </p>
            {model.summary.score == null ? (
              <p className="mt-0.5 text-sm font-semibold text-foreground">
                {loading
                  ? stageDetail ?? REPORT_COPY.reportFirst.checkingLabel
                  : REPORT_COPY.workspace.scoreUnavailable}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2.5 border-border/40 @[30rem]/pane:border-l @[30rem]/pane:pl-5">
          <Flag className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div className="min-w-0">
            <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
              {REPORT_COPY.workspace.unresolvedFlags}
            </p>
            <div className="mt-0.5 flex items-baseline gap-2">
              <span className="font-mono text-xl font-semibold tabular-nums leading-none text-foreground">
                {loading ? REPORT_COPY.reportFirst.checkingLabel : model.outcome.unresolvedCount}
              </span>
              {loading ? null : model.outcome.criticalCount > 0 && criticalHref ? (
                <a
                  href={criticalHref}
                  aria-label={REPORT_COPY.workspace.showCriticalFlags(model.outcome.criticalCount)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-destructive transition-colors hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
                >
                  <CircleAlert className="h-3.5 w-3.5" aria-hidden />
                  {REPORT_COPY.workspace.criticalCount(model.outcome.criticalCount)}
                </a>
              ) : (
                <span
                  aria-label={REPORT_COPY.workspace.criticalCount(0)}
                  className="text-xs font-medium text-success"
                >
                  {REPORT_COPY.workspace.noCriticalFlags}
                </span>
              )}
            </div>
          </div>
        </div>

        {verdict ? (
          <p
            title={verdict}
            className="line-clamp-2 min-w-0 flex-1 border-border/40 text-sm leading-relaxed text-muted-foreground text-pretty @[46rem]/pane:border-l @[46rem]/pane:pl-5"
          >
            {verdict}
          </p>
        ) : null}

        {showHistory ? (
          <div className="min-w-[9rem] flex-1 @[46rem]/pane:max-w-[16rem]">
            <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
              {REPORT_COPY.workspace.history}
              <span className="ml-1.5 normal-case tracking-normal text-foreground">
                {REPORT_COPY.workspace.scanCount(history.length)}
              </span>
            </p>
            <ScoreHistoryChart
              history={history}
              className="mt-1 h-auto w-full aspect-[360/72]"
              isLoading={loading}
              selectedIndex={selectedIndex ?? null}
              onSelect={onSelect}
            />
          </div>
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
