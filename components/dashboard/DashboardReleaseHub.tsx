import Link from 'next/link'
import type { Route } from 'next'
import { ArrowRight, Globe2 } from 'lucide-react'
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
    </section>
  )
}
