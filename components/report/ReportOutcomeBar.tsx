import type { ReactNode } from 'react'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import { SHIMMER_KEYFRAMES } from '@/components/ui/skeleton'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

/**
 * Compact Review header. This is the single place the Review presents its
 * current score, chronological Review history, and honest scan progress.
 */
export function ReportOutcomeBar({
  model,
  scanProgress,
  stageDetail,
  actions,
  className,
}: {
  model: ReportWorkspaceModel
  scanProgress?: number
  stageDetail?: string | null
  actions?: ReactNode
  className?: string
}) {
  const loading = model.context.loading
  const score = model.summary.score
  const scoreLabel = score === null
    ? loading
      ? REPORT_COPY.workspace.scorePending
      : REPORT_COPY.workspace.scoreUnavailable
    : String(Math.round(score))
  const history = model.summary.history ?? []
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
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1">
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}

        <div
          className="flex shrink-0 items-baseline gap-2"
          aria-label={`${REPORT_COPY.workspace.scoreLabel} ${scoreLabel}`}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {REPORT_COPY.workspace.scoreLabel}
          </span>
          <span className="font-mono text-sm font-medium leading-none tabular-nums text-muted-foreground">
            {scoreLabel}
          </span>
        </div>

        {history.length > 0 || loading ? (
          <ScoreHistoryChart
            history={history}
            currentAuditId={model.identity.auditId}
            className="min-w-0 flex-1"
            isLoading={loading}
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
