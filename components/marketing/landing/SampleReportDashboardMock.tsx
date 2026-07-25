import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  RefreshCw,
} from 'lucide-react'
import { ScoreRingGauge } from '@/components/report/ScoreRingGauge'
import type { SampleDashboardPreview } from '@/lib/marketing/sample-dashboard-preview'
import { cn } from '@/lib/utils'

interface SampleReportDashboardMockProps {
  preview: SampleDashboardPreview
  checksLabel: string
  className?: string
}

function severityIcon(severity: string) {
  const normalized = severity.toUpperCase()
  if (normalized === 'CRITICAL') {
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" strokeWidth={2} aria-hidden />
  }
  if (normalized === 'POLISH') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={2} aria-hidden />
  }
  return (
    <span
      className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-brand/90"
      aria-hidden
    />
  )
}

function severityTone(severity: string) {
  const normalized = severity.toUpperCase()
  if (normalized === 'CRITICAL') return 'text-destructive bg-destructive/10'
  if (normalized === 'POLISH') return 'text-muted-foreground bg-muted'
  return 'text-brand bg-brand/10'
}

/** Decorative homepage mock: layout from marketing design, data from sample report only. */
export function SampleReportDashboardMock({
  preview,
  checksLabel,
  className,
}: SampleReportDashboardMockProps) {
  const { host, score, flagCount, rubricCounts, rubricScores, issues, selected } = preview

  return (
    <div
      aria-hidden
      className={cn(
        'relative rounded-card bg-background shadow-[0_1px_2px_hsl(240_8%_5%/0.04),0_24px_56px_-24px_hsl(240_8%_5%/0.28)]',
        className
      )}
    >
      <div className="min-h-[30rem] sm:min-h-[34rem]">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/40 px-4 py-3.5 sm:px-5">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">{host}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Sample Finish Plan</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 items-center rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground">
              Share report
            </span>
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border/70 bg-background px-3 text-xs font-medium text-muted-foreground">
              <RefreshCw className="h-3 w-3" strokeWidth={2} />
              Re-check
            </span>
          </div>
        </header>

        <div className="grid gap-3 border-b border-border/40 p-4 sm:grid-cols-3 sm:gap-3 sm:p-5">
          <div className="flex items-center gap-3 rounded-[var(--radius-inner)] bg-muted/40 px-3 py-3">
            <ScoreRingGauge score={score} size="sm" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-muted-foreground">Release readiness</p>
              <p className="mt-1 text-sm font-semibold text-foreground">Score</p>
            </div>
          </div>

          <div className="rounded-[var(--radius-inner)] bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">High impact issues</p>
            <p className="mt-1 font-mono text-3xl font-semibold tabular-nums leading-none text-foreground">
              {flagCount}
            </p>
            <p className="mt-2 text-xs font-medium text-destructive">Needs attention</p>
            <p className="mt-3 inline-flex items-center gap-1 text-[0.6875rem] text-muted-foreground">
              <CheckCircle2 className="h-3 w-3 text-emerald-600" strokeWidth={2} />
              {checksLabel}
            </p>
          </div>

          <div className="rounded-[var(--radius-inner)] bg-muted/40 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">By rubric</p>
            <ul className="mt-2.5 space-y-2">
              {rubricScores.map((row) => (
                <li key={row.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">{row.label}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {row.score == null ? '—' : row.score}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="relative grid gap-4 p-4 sm:p-5 lg:grid-cols-[minmax(0,1fr)_minmax(15rem,17.5rem)] lg:gap-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5 border-b border-border/40 pb-3">
              <TabChip active label={`All issues ${flagCount}`} />
              <TabChip label={`Message ${rubricCounts.message}`} />
              <TabChip label={`Experience ${rubricCounts.experience}`} />
              <TabChip label={`Reach ${rubricCounts.reach}`} />
            </div>

            <ul className="mt-3 divide-y divide-border/40">
              {issues.map((issue, index) => (
                <li
                  key={issue.id}
                  className={cn(
                    'flex items-center gap-2.5 px-2 py-2.5',
                    index === 0 && 'rounded-[var(--radius-control)] bg-destructive/[0.06]'
                  )}
                >
                  {severityIcon(issue.severity)}
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {issue.title}
                  </span>
                  <span
                    className={cn(
                      'hidden shrink-0 rounded-full px-2 py-0.5 text-[0.625rem] font-semibold sm:inline',
                      severityTone(issue.severity)
                    )}
                  >
                    {issue.severityLabel.replace(/ Flag$/i, '')}
                  </span>
                  <span className="hidden shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-muted-foreground sm:inline">
                    {issue.rubric}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs font-medium text-muted-foreground">
              View all {flagCount} issues →
            </p>
          </div>

          {selected ? (
            <div className="rounded-card border border-border/50 bg-background p-4 shadow-[0_18px_40px_-24px_hsl(240_8%_5%/0.35)] sm:p-5">
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-snug text-foreground">{selected.title}</p>
                <span className="mt-1.5 inline-flex rounded-full bg-destructive/10 px-2 py-0.5 text-[0.625rem] font-semibold text-destructive">
                  {selected.severityLabel}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-label text-muted-foreground">
                    Why it matters
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground text-pretty">
                    {selected.why}
                  </p>
                </div>

                {selected.impactLabels.length > 0 ? (
                  <div>
                    <p className="text-[0.6875rem] font-semibold uppercase tracking-label text-muted-foreground">
                      Impact
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {selected.impactLabels.map((label) => (
                        <span
                          key={label}
                          className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[0.625rem] font-medium text-foreground"
                        >
                          {label}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <p className="text-[0.6875rem] font-semibold uppercase tracking-label text-muted-foreground">
                    Fix prompt
                  </p>
                  <div className="mt-1.5 line-clamp-4 rounded-[var(--radius-control)] bg-muted/60 px-3 py-2.5 text-[0.6875rem] leading-relaxed text-foreground/80">
                    {selected.fixPrompt || 'Open the sample report to copy the full fix prompt.'}
                  </div>
                  <span className="mt-2.5 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-full bg-foreground text-xs font-semibold text-background">
                    <Copy className="h-3.5 w-3.5" strokeWidth={2} />
                    Copy prompt
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function TabChip({ label, active = false }: { label: string; active?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex h-7 items-center rounded-full px-2.5 text-[0.6875rem] font-medium',
        active ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'
      )}
    >
      {label}
    </span>
  )
}
