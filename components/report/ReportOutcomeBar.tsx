import Link from 'next/link'
import { CircleHelp } from 'lucide-react'
import { RecheckDiffStrip } from '@/components/audit/RecheckDiffStrip'
import { SHIMMER_KEYFRAMES } from '@/components/ui/skeleton'
import { ScoreHistoryChart } from '@/components/report/ScoreHistoryChart'
import { REPORT_COPY, SCORE_HELP } from '@/lib/marketing/copy'
import { helpHrefForSurface } from '@/lib/help/contextual'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import {
  comparableScoreFromDiff,
  countsFromUpdateDiff,
  previousScoreFromHistory,
  scoreOffsetExplanation,
} from '@/lib/audit/update-review-progress'
import { cn } from '@/lib/utils'
import { ScoreRing } from '@/components/report/ScoreRing'
import type { ReactNode } from 'react'

/**
 * Compact Review header: score + owner actions on row 1; Review history owns
 * a full-width horizontally scrollable band on row 2.
 */
export function ReportOutcomeBar({
  model,
  scanProgress,
  stageDetail,
  className,
  actions,
}: {
  model: ReportWorkspaceModel
  scanProgress?: number
  stageDetail?: string | null
  className?: string
  actions?: ReactNode
}) {
  const loading = model.context.loading
  const score = model.summary.score
  const history = model.summary.history
  const updateDiff = model.summary.updateDiff ?? null
  const scoreNote =
    updateDiff && !loading
      ? scoreOffsetExplanation({
          previousScore: previousScoreFromHistory(history, model.identity.auditId),
          currentScore: score,
          counts: countsFromUpdateDiff(updateDiff),
        })
      : null
  const comparableScore =
    updateDiff && !loading ? comparableScoreFromDiff(updateDiff) : null
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
      <div className="flex min-h-14 min-w-0 flex-wrap items-center gap-x-4 gap-y-2 py-1">
        <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-x-3 gap-y-1">
          <ScoreRing score={score} pending={loading} />
          {!loading && score != null ? (
            <Link
              href={helpHrefForSurface('score_help')}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="How scores work"
              title={SCORE_HELP.diagnostic}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
            >
              <CircleHelp className="h-4 w-4" aria-hidden />
            </Link>
          ) : null}
          {comparableScore != null && !loading ? (
            <p
              className="min-w-0 text-sm text-muted-foreground"
              title={SCORE_HELP.comparableHelp}
            >
              <span className="uppercase tracking-label text-2xs">{SCORE_HELP.comparableLabel}</span>
              {' '}
              <span className="font-mono tabular-nums text-foreground">{comparableScore}</span>
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>

      {history ? (
        <div className="w-full min-w-0 border-t border-border/35 py-2">
          <ScoreHistoryChart
            history={history}
            currentAuditId={model.identity.auditId}
            isLoading={loading}
            className="w-full"
          />
        </div>
      ) : null}

      {updateDiff && !loading ? (
        <div className="space-y-2 border-t border-border/35 py-3">
          <RecheckDiffStrip summary={updateDiff} />
          {scoreNote ? (
            <p className="text-sm text-muted-foreground">{scoreNote}</p>
          ) : null}
        </div>
      ) : null}

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
