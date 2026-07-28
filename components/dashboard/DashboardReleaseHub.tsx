import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Globe2 } from 'lucide-react'
import { ReportFixLoop } from '@/components/report/ReportFixLoop'
import {
  ReportWorkspaceOutcome,
  ReportWorkspaceSummary,
} from '@/components/report/ReportWorkspaceChrome'
import { Button } from '@/components/ui/button'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'

export function DashboardReleaseHub({
  model,
}: {
  model: ReportWorkspaceModel
}) {
  const reportHref = `/report/${model.identity.auditId}`
  const flags = model.explorer.flags.slice(0, 5).map((flag) => ({
    id: flag.id,
    title: flag.title,
    rubric: flag.rubric,
    impactTag: flag.impactTag,
    severity: flag.severity,
    hasFixPrompt: false,
  }))
  const topFlag = flags[0]

  return (
    <section
      aria-labelledby="release-hub-heading"
      className="space-y-5 rounded-card bg-background/85 p-4 shadow-glass-deep glass-surface sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/55 text-muted-foreground">
            <Globe2 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 id="release-hub-heading" className="truncate text-base font-semibold">
              {model.identity.displayHost}
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              {REPORT_COPY.workspace.dashboard.latestRelease}
              {model.summary.history
                ? ` · ${REPORT_COPY.workspace.dashboard.rechecks(model.summary.history.length - 1)}`
                : ''}
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={reportHref as Route}>
            {REPORT_COPY.workspace.dashboard.openReport}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
      </div>

      <ReportWorkspaceOutcome model={model} compact />
      <ReportWorkspaceSummary model={model} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(15rem,0.75fr)]">
        <div className="min-w-0">
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">
              {REPORT_COPY.workspace.dashboard.topFlags}
            </h3>
            <span className="text-xs tabular-nums text-muted-foreground">
              {REPORT_COPY.workspace.dashboard.total(model.outcome.unresolvedCount)}
            </span>
          </div>
          <ReportFixLoop flags={flags} reportHref={reportHref} compact />
        </div>
        <div className="flex min-h-32 flex-col justify-between rounded-[var(--radius-inner)] bg-muted/35 p-4">
          <div>
            <p className="text-2xs font-medium uppercase tracking-label text-muted-foreground">
              {REPORT_COPY.workspace.dashboard.nextActionLabel}
            </p>
            <p className="mt-2 text-sm font-medium text-foreground">
              {topFlag
                ? REPORT_COPY.workspace.dashboard.nextActionBody
                : REPORT_COPY.workspace.dashboard.clearReleaseBody}
            </p>
          </div>
          <Button asChild className="mt-4 w-full">
            <Link
              href={
                (topFlag
                  ? `${reportHref}?flag=${encodeURIComponent(topFlag.id)}`
                  : reportHref) as Route
              }
            >
              {topFlag
                ? REPORT_COPY.workspace.dashboard.reviewTopFlag
                : REPORT_COPY.workspace.dashboard.reviewClearRelease}
            </Link>
          </Button>
        </div>
      </div>
    </section>
  )
}
