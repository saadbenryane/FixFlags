import Link from 'next/link'
import { SHIMMER_KEYFRAMES } from '@/components/ui/skeleton'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

/**
 * Report header: name and a way back to the reports list.
 * Completeness sits with the category tabs, not as a Score hero.
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
  actions?: React.ReactNode
  className?: string
}) {
  const loading = model.context.loading
  const name = model.identity.displayHost || REPORT_COPY.workspace.identityFallback
  const progress = typeof scanProgress === 'number'
    ? Math.min(100, Math.max(0, Math.round(scanProgress)))
    : null

  return (
    <section
      id="report-status"
      aria-label={name}
      className={cn(
        'w-full shrink-0 scroll-mt-[var(--report-chrome-offset)]',
        className,
      )}
    >
      <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 py-1">
        <Link
          href="/dashboard"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {REPORT_COPY.workspace.dashboard.title}
        </Link>
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">
          {name}
        </p>
        {actions ? (
          <div className="ml-auto flex min-w-0 flex-wrap items-center gap-2">{actions}</div>
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
