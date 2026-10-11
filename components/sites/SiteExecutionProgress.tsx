import type { ExecutionProgress } from '@/lib/sites/application/execution-progress'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function SiteExecutionProgress({ progress }: { progress: ExecutionProgress }) {
  const copy = SITE_ACTION_COPY.execution
  const state = (value: string) => copy.states[value as keyof typeof copy.states] ?? value
  const kind = (value: string) => copy.kinds[value as keyof typeof copy.kinds] ?? value
  return <section className="rounded-board-panel border border-border p-4" aria-label={copy.title}>
    <p className="text-sm font-medium" role="status" aria-live="polite" aria-atomic="true">
      {copy.completed(progress.completed, progress.total)}
      {progress.running > 0 && ` · ${copy.running(progress.running)}`}
      {progress.recovering > 0 && ` · ${copy.recovering(progress.recovering)}`}
    </p>
    {(progress.unknown > 0 || progress.inapplicable > 0) && <p className="mt-1 text-sm text-muted-foreground">
      {[progress.unknown ? copy.unknown(progress.unknown) : null, progress.inapplicable ? copy.inapplicable(progress.inapplicable) : null].filter(Boolean).join(' · ')}
    </p>}
    <details className="mt-2">
      <summary className="flex min-h-11 cursor-pointer items-center text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2">{copy.details}</summary>
      <p className="mb-2 text-sm text-muted-foreground">{copy.limitation}</p>
      <ul className="max-h-72 space-y-3 overflow-auto">
        {progress.tasks.map(task => <li key={task.id} className="text-sm">
          <div className="flex flex-wrap justify-between gap-2"><span>{task.module ? copy.modules[task.module as keyof typeof copy.modules] ?? kind(task.kind) : kind(task.kind)}{task.device ? ` · ${copy.devices[task.device]}` : ''}</span><span className="text-muted-foreground">{state(task.state)}</span></div>
          <p className="break-all text-xs text-muted-foreground">{task.pageUrl}</p>
        </li>)}
      </ul>
      {progress.total > progress.tasks.length && <p className="mt-3 text-xs text-muted-foreground">{copy.bounded}</p>}
    </details>
  </section>
}
