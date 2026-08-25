import { SHIMMER_KEYFRAMES } from '@/components/ui/skeleton'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

/**
 * Compact Review header. Product identity and owner actions intentionally live
 * elsewhere; this is the single Score, Review history, and progress surface.
 */
export function ReportOutcomeBar({
  model,
  scanProgress,
  stageDetail,
  className,
}: {
  model: ReportWorkspaceModel
  scanProgress?: number
  stageDetail?: string | null
  className?: string
}) {
  const loading = model.context.loading
  const score = model.summary.score
  const history = model.summary.history
  const progress = typeof scanProgress === 'number'
    ? Math.min(100, Math.max(0, Math.round(scanProgress)))
    : null

  return (
    <section
      id="report-status"
      aria-label={REPORT_COPY.workspace.summaryLabel}
      className={cn(
        'w-full shrink-0 scroll-mt-[var(--report-chrome-offset)]',
        className,
      )}
    >
      <div className="flex min-h-11 min-w-0 flex-wrap items-center gap-x-4 gap-y-1 py-1">
        <p
          className="shrink-0 font-mono text-sm font-semibold tabular-nums text-foreground"
          aria-label={loading ? 'Score pending' : score == null ? 'Score unavailable' : `Score ${Math.round(score)}`}
        >
          <span className="text-muted-foreground">{REPORT_COPY.workspace.scoreLabel}</span>{' '}
          {loading
            ? REPORT_COPY.workspace.scorePending
            : score == null
              ? REPORT_COPY.workspace.scoreUnavailable
              : Math.round(score)}
        </p>
        {history ? (
          <ScoreHistoryChart
            history={history}
            currentAuditId={model.identity.auditId}
            isLoading={loading}
            className="min-w-0 flex-1"
          />
        ) : null}
      </div>

      {loading ? (
        <div
          className="border-t border-border/35 px-4 pb-3 pt-2.5"
          role="status"
          aria-label="Scan progress"
          aria-live="polite"
          aria-atomic="true"
        >
          {progress !== null ? <style>{SHIMMER_KEYFRAMES}</style> : null}
          <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">
              {stageDetail ?? REPORT_COPY.reportFirst.checkingLabel}
            </span>
            {progress !== null ? (
              <span className="font-mono tabular-nums">{progress}%</span>
            ) : null}
          </div>
          {progress !== null ? (
            <div className="relative mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
              <div
                className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-700 motion-safe:ease-out"
                style={{ width: `${progress}%` }}
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-r from-transparent via-brand/25 to-transparent motion-safe:animate-[ff-shimmer_2.4s_linear_infinite]"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
