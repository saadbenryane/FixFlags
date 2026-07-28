import type { ReactNode } from 'react'
import { Globe2 } from 'lucide-react'
import { ReportExplorer } from '@/components/report/ReportExplorer'
import {
  ReportWorkspaceOutcome,
  ReportWorkspaceSummary,
} from '@/components/report/ReportWorkspaceChrome'
import { Badge } from '@/components/ui/badge'
import { REPORT_COPY } from '@/lib/marketing/copy'
import type { ReportWorkspaceModel } from '@/lib/report/workspace-model'
import { cn } from '@/lib/utils'

export function ReportWorkspace({
  model,
  density = 'full',
  actions,
  className,
  signUpHref,
}: {
  model: ReportWorkspaceModel
  density?: 'compact' | 'full' | 'hub'
  actions?: ReactNode
  className?: string
  signUpHref?: string
}) {
  const compact = density === 'compact'
  const checkedAt = model.identity.checkedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(model.identity.checkedAt)
    : null
  const explorerVariant = compact ? 'hero' : 'live'
  const promptLocked = model.capabilities.promptAccess !== 'all'

  return (
    <section
      aria-label="FixFlags report workspace"
      className={cn(
        'space-y-4',
        density === 'full' && 'sm:space-y-5',
        className
      )}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-muted/55 text-muted-foreground">
            <Globe2 className="h-4 w-4" aria-hidden />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-sm font-semibold text-foreground">
                {model.identity.displayHost}
              </h2>
              <Badge variant="secondary" className="text-xs">
                {REPORT_COPY.workspace.status[model.identity.status]}
              </Badge>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {model.identity.pageType ?? REPORT_COPY.workspace.identityFallback}
              {checkedAt ? ` · ${checkedAt}` : ''}
            </p>
          </div>
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            {actions}
          </div>
        ) : null}
      </div>

      <ReportWorkspaceOutcome model={model} compact={compact} />
      <ReportWorkspaceSummary model={model} />

      <div id="report-flags" className="scroll-mt-[var(--header-offset)]">
        <ReportExplorer
          model={model.explorer}
          variant={explorerVariant}
          aiLocked={promptLocked}
          signUpHref={signUpHref}
          demonstratedFlagId={model.capabilities.demonstratedFlagId ?? undefined}
          className={compact ? 'shadow-card' : undefined}
        />
      </div>
    </section>
  )
}
