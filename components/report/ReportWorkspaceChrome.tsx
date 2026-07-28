import { AlertTriangle, Flag, History } from 'lucide-react'
import { RubricBar } from '@/components/audit/RubricBar'
import { ScoreSparkline } from '@/components/audit/ScoreSparkline'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

export function ReportWorkspaceOutcome({
  model,
  compact = false,
  className,
}: {
  model: ReportWorkspaceModel
  compact?: boolean
  className?: string
}) {
  const unresolved = model.outcome.unresolvedCount

  return (
    <header className={cn('space-y-2', className)}>
      <h2
        className={cn(
          'font-sans font-semibold tracking-heading text-balance text-foreground',
          compact ? 'text-xl sm:text-2xl' : 'text-2xl sm:text-3xl'
        )}
      >
        {REPORT_COPY.workspace.heading}
      </h2>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground text-pretty">
        {model.context.loading
          ? REPORT_COPY.workspace.checkingScope
          : REPORT_COPY.workspace.context({
              unresolved,
              checkedScope: model.outcome.checkedScope,
            })}
      </p>
    </header>
  )
}

export function ReportWorkspaceSummary({
  model,
  className,
}: {
  model: ReportWorkspaceModel
  className?: string
}) {
  const rubrics = model.summary.rubrics.map((rubric) => ({
    name: rubric.name,
    criticalCount: rubric.criticalCount,
  }))
  const scores = model.summary.history?.map((point) => point.score) ?? []
  const firstCritical = model.explorer.flags.find(
    (flag) => flag.severity === 'CRITICAL'
  )
  const firstCriticalIds = Object.fromEntries(
    model.summary.rubrics.flatMap((rubric) => {
      const flag = model.explorer.flags.find(
        (candidate) =>
          candidate.rubric === rubric.name &&
          candidate.severity === 'CRITICAL'
      )
      return flag ? [[rubric.name, flag.id]] : []
    })
  )
  const criticalHref = firstCritical
    ? `?severity=CRITICAL&flag=${encodeURIComponent(firstCritical.id)}#report-flags`
    : undefined

  return (
    <section
      aria-label={REPORT_COPY.workspace.summaryLabel}
      className={cn(
        'overflow-hidden rounded-card bg-card/80 shadow-card glass-surface',
        className
      )}
    >
      <div
        className={cn(
          'grid',
          scores.length > 1
            ? 'md:grid-cols-[minmax(10rem,0.8fr)_minmax(0,2.4fr)_minmax(10rem,0.9fr)]'
            : 'md:grid-cols-[minmax(10rem,0.8fr)_minmax(0,2.4fr)]'
        )}
      >
        <SummarySegment
          icon={model.outcome.criticalCount > 0 ? AlertTriangle : Flag}
          label={REPORT_COPY.workspace.criticalFlags}
          value={
            model.context.loading
              ? REPORT_COPY.reportFirst.checkingLabel
              : String(model.outcome.criticalCount)
          }
          href={criticalHref}
          ariaLabel={
            model.context.loading
              ? REPORT_COPY.reportFirst.statusPendingLabel
              : model.outcome.criticalCount > 0
                ? REPORT_COPY.workspace.showCriticalFlags(
                    model.outcome.criticalCount
                  )
                : REPORT_COPY.workspace.criticalCount(0)
          }
        />
        <div className="min-w-0 border-t border-border/35 md:border-l md:border-t-0">
          <RubricBar
            rubrics={rubrics}
            firstCriticalIds={firstCriticalIds}
            loading={model.context.loading}
          />
        </div>
        {scores.length > 1 ? (
          <div className="border-t border-border/35 p-3 sm:p-4 md:border-l md:border-t-0">
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-muted-foreground" aria-hidden />
              <div>
                <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
                  {REPORT_COPY.workspace.history}
                </p>
                <p className="mt-0.5 text-xs font-medium text-foreground">
                  {REPORT_COPY.workspace.recheckCount(scores.length - 1)}
                </p>
              </div>
            </div>
            <ScoreSparkline
              scores={scores}
              width={120}
              height={28}
              responsive
              className="mt-3 h-7 w-full"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

function SummarySegment({
  icon: Icon,
  label,
  value,
  ariaLabel,
  href,
}: {
  icon: typeof Flag
  label: string
  value: string
  ariaLabel?: string
  href?: string
}) {
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {value}
        </p>
      </div>
    </>
  )

  const className = cn(
    'flex min-h-16 items-center gap-3 border-t border-border/35 p-3 first:border-t-0 sm:p-4 md:border-l md:border-t-0 md:first:border-l-0',
    href &&
      'transition-colors duration-150 hover:bg-accent/45 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring'
  )

  return href ? (
    <a href={href} aria-label={ariaLabel} className={className}>
      {content}
    </a>
  ) : (
    <div aria-label={ariaLabel} className={className}>
      {content}
    </div>
  )
}
