import { AlertTriangle, Flag, History, ShieldCheck } from 'lucide-react'
import { RubricBar } from '@/components/audit/RubricBar'
import { ScoreSparkline } from '@/components/audit/ScoreSparkline'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

const READINESS_LABELS = {
  ready: REPORT_COPY.workspace.readiness.ready,
  fix_first: REPORT_COPY.workspace.readiness.fixFirst,
  not_ready: REPORT_COPY.workspace.readiness.notReady,
  checking: REPORT_COPY.workspace.readiness.checking,
  unavailable: REPORT_COPY.workspace.readiness.unavailable,
} as const

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
  const highImpact = model.outcome.highImpactCount

  return (
    <header className={cn('space-y-2', className)}>
      <p className="section-label">{REPORT_COPY.workspace.eyebrow}</p>
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
              highImpact,
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
    status: rubric.status,
    flagCount: rubric.flagCount,
    criticalCount: rubric.criticalCount,
    importantCount: rubric.importantCount,
  }))
  const rubricRows = model.summary.rubrics.map((rubric) => ({
    name: rubric.name,
    score: rubric.score,
    grade: rubric.grade,
  }))
  const scores = model.summary.history?.map((point) => point.score) ?? []

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
            ? 'md:grid-cols-[minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(0,2fr)_minmax(10rem,0.9fr)]'
            : 'md:grid-cols-[minmax(10rem,0.8fr)_minmax(10rem,0.8fr)_minmax(0,2fr)]'
        )}
      >
        <SummarySegment
          icon={ShieldCheck}
          label={REPORT_COPY.workspace.readiness.label}
          value={READINESS_LABELS[model.summary.readiness]}
        />
        <SummarySegment
          icon={model.outcome.highImpactCount > 0 ? AlertTriangle : Flag}
          label={REPORT_COPY.workspace.highImpact}
          value={
            model.context.loading && model.outcome.unresolvedCount === 0
              ? REPORT_COPY.workspace.readiness.checking
              : String(model.outcome.highImpactCount)
          }
        />
        <div className="min-w-0 border-t border-border/35 p-3 sm:p-4 md:border-l md:border-t-0">
          <p className="mb-2 text-2xs font-medium uppercase tracking-label text-muted-foreground">
            {REPORT_COPY.workspace.rubricCoverage}
          </p>
          <RubricBar
            rubrics={rubrics}
            rubricRows={rubricRows}
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
}: {
  icon: typeof Flag
  label: string
  value: string
}) {
  return (
    <div className="flex min-h-16 items-center gap-3 border-t border-border/35 p-3 first:border-t-0 sm:p-4 md:border-l md:border-t-0 md:first:border-l-0">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
          {label}
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
          {value}
        </p>
      </div>
    </div>
  )
}
