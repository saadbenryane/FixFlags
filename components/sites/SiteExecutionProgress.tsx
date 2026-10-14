import { ChevronDown, Loader2 } from 'lucide-react'
import type { ExecutionProgress } from '@/lib/sites/application/execution-progress'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function SiteExecutionProgress({ progress, compact = false }: { progress: ExecutionProgress; compact?: boolean }) {
  const copy = SITE_ACTION_COPY.execution
  const state = (value: string) => copy.states[value as keyof typeof copy.states] ?? value
  const kind = (value: string) => copy.kinds[value as keyof typeof copy.kinds] ?? value
  const summary = progress.summary
  const active = summary ? summary.state === 'active' : progress.pending + progress.running + progress.recovering > 0
  const label = [copy.recorded(summary?.recorded ?? progress.completed),
    summary?.limited ? copy.limited(summary.limited) : null,
    summary?.failed ? copy.failed(summary.failed) : null,
    progress.inapplicable ? copy.inapplicable(progress.inapplicable) : null].filter(Boolean).join(' · ')
  return <section className={compact ? 'mt-3 pt-3' : 'rounded-board-panel bg-muted/20 p-4'} aria-label={copy.title}>
    <div className="flex flex-wrap items-center justify-between gap-2">
    <p className="text-xs font-medium tabular-nums sm:text-sm" role="status" aria-live="polite" aria-atomic="true">
      {label}
      {progress.running > 0 && ` · ${copy.running(progress.running)}`}
      {progress.recovering > 0 && ` · ${copy.recovering(progress.recovering)}`}
    </p>
    {!compact && active ? <span className="text-xs text-muted-foreground">{copy.live}</span> : null}
    </div>
    {active ? <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={progress.total || 1} aria-valuenow={progress.total - progress.pending - progress.running - progress.recovering} className="my-3 h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-brand motion-safe:transition-[width] motion-safe:duration-500" style={{ width: `${progress.total ? Math.min(100, (progress.total - progress.pending - progress.running - progress.recovering) / progress.total * 100) : 0}%` }} />
    </div> : progress.unknown > 0 ? <p className="mt-2 text-sm text-muted-foreground">{copy.settled}</p> : null}
    {!summary && (progress.unknown > 0 || progress.inapplicable > 0) && <p className="mt-1 text-sm text-muted-foreground">
      {[progress.unknown ? copy.unknown(progress.unknown) : null, progress.inapplicable ? copy.inapplicable(progress.inapplicable) : null].filter(Boolean).join(' · ')}
    </p>}
    <details className="group">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 text-xs font-medium text-muted-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden">{copy.details}<ChevronDown size={15} className="shrink-0 group-open:rotate-180" aria-hidden /></summary>
      <p className="mb-2 text-sm text-muted-foreground">{copy.limitation}</p>
      <ul className="max-h-72 space-y-1 overflow-auto overscroll-contain">
        {progress.tasks.map(task => <li key={task.id} className="py-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span>{task.module ? copy.modules[task.module as keyof typeof copy.modules] ?? kind(task.kind) : kind(task.kind)}{task.device ? ` · ${copy.devices[task.device]}` : ''}</span><span className="inline-flex items-center gap-2 text-xs text-muted-foreground">{task.state === 'RUNNING' ? <Loader2 size={13} className="text-brand motion-safe:animate-spin" aria-hidden /> : null}{state(task.state)}</span></div>
          <p className="break-all text-xs text-muted-foreground">{task.pageUrl}</p>
        </li>)}
      </ul>
      {progress.total > progress.tasks.length && <p className="mt-3 text-xs text-muted-foreground">{copy.bounded}</p>}
    </details>
  </section>
}
