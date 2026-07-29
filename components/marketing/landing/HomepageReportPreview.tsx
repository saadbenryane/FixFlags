import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowRight,
  ChartNoAxesColumnIncreasing,
  CheckCircle2,
  CircleAlert,
  Globe2,
  LayoutGrid,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
  UserRound,
} from 'lucide-react'
import { ReportWorkspaceSummary } from '@/components/report/ReportWorkspaceChrome'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { rubricIcon } from '@/lib/rubric-icons'
import { cn } from '@/lib/utils'

export function HomepageReportPreview({
  model,
}: {
  model: ReportWorkspaceModel
}) {
  const selectedFlag =
    model.explorer.flags.find((flag) => flag.severity === 'CRITICAL') ??
    model.explorer.flags[0]
  const rubricCounts = model.summary.rubrics.map((rubric) => ({
    id: rubric.name,
    label: rubric.label,
    count: rubric.flagCount,
  }))
  const reportDate = model.identity.checkedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(model.identity.checkedAt)
    : null

  return (
    <div className="relative overflow-hidden rounded-card bg-background shadow-glass-hero ring-1 ring-border/55">
      <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border/45 px-4 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Image
            src="/brand/logo-mark.png"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0"
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {model.identity.displayHost}
            </p>
            <p className="mt-0.5 truncate text-2xs text-muted-foreground">
              Curated sample{reportDate ? ` · ${reportDate}` : ''}
            </p>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/samples"
            className="inline-flex min-h-9 items-center rounded-[var(--radius-control)] border border-border/55 bg-background px-3 text-2xs font-medium text-foreground transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            Share report
          </Link>
          <Link
            href="/samples"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-[var(--radius-control)] border border-border/55 bg-background px-3 text-2xs font-medium text-foreground transition-colors hover:bg-muted/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            Re-check
          </Link>
        </div>
      </header>

      <div className="grid sm:grid-cols-[3.5rem_minmax(0,1fr)]">
        <aside
          aria-label="Sample report navigation"
          className="hidden bg-muted/15 px-2 py-4 sm:flex sm:flex-col sm:items-center sm:gap-2"
        >
          {[
            LayoutGrid,
            MessageSquare,
            UserRound,
            Globe2,
            ShieldCheck,
            ChartNoAxesColumnIncreasing,
          ].map((Icon, index) => (
            <span
              key={index}
              className={cn(
                'inline-flex h-9 w-9 items-center justify-center rounded-[var(--radius-control)] text-muted-foreground',
                index === 0 && 'bg-muted/70 text-foreground'
              )}
            >
              <Icon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </span>
          ))}
        </aside>

        <div className="min-w-0 p-3 sm:p-4">
          <ReportWorkspaceSummary
            model={model}
            reportHref="/samples"
            className="rounded-[var(--radius-inner)] shadow-none ring-1 ring-border/45"
          />

          <div className="mt-3.5 grid min-w-0 gap-3.5 lg:grid-cols-[minmax(19rem,1.1fr)_minmax(17rem,0.9fr)]">
            <div className="min-w-0">
              <div className="flex min-w-0 gap-1 overflow-x-auto border-b border-border/40 pb-2.5 scrollbar-none">
                <span className="inline-flex min-h-8 shrink-0 items-center rounded-[var(--radius-control)] bg-foreground px-3 text-2xs font-medium text-background">
                  All Flags
                  <span className="ml-1.5 font-mono opacity-65">
                    {model.outcome.unresolvedCount}
                  </span>
                </span>
                {rubricCounts.map((rubric) => (
                  <span
                    key={rubric.id}
                    className="inline-flex min-h-8 shrink-0 items-center rounded-[var(--radius-control)] bg-muted/45 px-3 text-2xs font-medium text-muted-foreground"
                  >
                    {rubric.label}
                    <span className="ml-1.5 font-mono opacity-65">
                      {rubric.count}
                    </span>
                  </span>
                ))}
              </div>

              <ul className="mt-1.5 divide-y divide-border/35" aria-label="Sample Flags">
                {model.explorer.flags.slice(0, 5).map((flag) => {
                  const RubricIcon = rubricIcon(flag.rubric)
                  const selected = flag.id === selectedFlag?.id
                  const SeverityIcon =
                    flag.severity === 'CRITICAL' ? CircleAlert : TriangleAlert
                  return (
                    <li
                      key={flag.id}
                      className={cn(
                        'flex min-h-12 items-center gap-2.5 rounded-[var(--radius-control)] px-2.5 text-left',
                        selected && 'bg-accent/45'
                      )}
                    >
                      <SeverityIcon
                        className={cn(
                          'h-4 w-4 shrink-0',
                          flag.severity === 'CRITICAL'
                            ? 'text-destructive'
                            : 'text-grade-D'
                        )}
                        aria-hidden
                      />
                      <RubricIcon
                        className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
                        {flag.title}
                      </span>
                      <span className="hidden shrink-0 text-3xs font-medium text-muted-foreground xl:inline">
                        {flag.rubricLabel}
                      </span>
                    </li>
                  )
                })}
              </ul>
              <Link
                href="/samples"
                className="mt-2 inline-flex min-h-9 items-center gap-1.5 px-2 text-xs font-semibold text-foreground transition-colors hover:text-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus-ring"
              >
                View all {model.outcome.unresolvedCount} Flags
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>

            {selectedFlag ? (
              <div className="min-w-0 rounded-[var(--radius-inner)] bg-card/55 p-4 shadow-raised ring-1 ring-border/40">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold leading-snug text-foreground">
                      {selectedFlag.title}
                    </p>
                    <p className="mt-1 text-2xs font-medium text-destructive">
                      {selectedFlag.severityLabel} · {selectedFlag.rubricLabel}
                    </p>
                  </div>
                  <CircleAlert className="h-4 w-4 shrink-0 text-destructive" aria-hidden />
                </div>

                <div className="mt-4 space-y-3.5">
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-label text-muted-foreground">
                      Why it matters
                    </p>
                    <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {selectedFlag.whyItMatters}
                    </p>
                  </div>
                  <div>
                    <p className="text-3xs font-semibold uppercase tracking-label text-muted-foreground">
                      Fix prompt
                    </p>
                    <p className="mt-1.5 line-clamp-4 rounded-[var(--radius-control)] bg-background px-3 py-2.5 font-mono text-[0.625rem] leading-relaxed text-foreground/80 ring-1 ring-border/45">
                      {selectedFlag.fixPrompt}
                    </p>
                  </div>
                  <div className="flex min-h-9 items-center justify-between gap-3 rounded-[var(--radius-control)] bg-foreground px-3 text-background">
                    <span className="inline-flex items-center gap-1.5 text-2xs font-medium">
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" aria-hidden />
                      Ready for your editor
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 text-background/65" aria-hidden />
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
