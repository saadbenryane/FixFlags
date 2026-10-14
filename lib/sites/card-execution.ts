import { CHECK_MODULES } from '@/lib/audit/check-registry'
import type { ExecutionProgress } from '@/lib/sites/application/execution-progress'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

type Task = ExecutionProgress['tasks'][number]

export function taskArea(task: Pick<Task, 'kind' | 'module'>): SiteCardArea | null {
  if (task.kind === 'search' || task.kind === 'search-resources' || task.kind === 'google') return 'search'
  if (task.kind === 'pagespeed' || task.kind === 'slow-replay') return 'performance'
  if (task.kind === 'keyboard') return 'accessibility'
  if (task.kind === 'flow' || task.kind === 'journeys') return 'conversion'
  if (task.module && CHECK_MODULES[task.module]) return CHECK_MODULES[task.module].area
  if (['http', 'browser', 'captures', 'discovery', 'cross-page'].includes(task.kind)) return 'site'
  return null
}

/** Only attribute active work from the recorded task list, which may be bounded. */
export function cardExecution(area: SiteCardArea, progress: ExecutionProgress | null | undefined) {
  const copy = SITE_ACTION_COPY.execution
  const tasks = progress?.tasks.filter(task => taskArea(task) === area) ?? []
  const active = tasks.filter(task => task.state === 'RUNNING')
  const recovering = tasks.filter(task => task.state === 'RETRY_WAIT')
  const task = active[0] ?? recovering[0]
  if (!task) return null
  const label = task.module ? copy.modules[task.module as keyof typeof copy.modules] : undefined
  return {
    status: active.length ? copy.running(active.length) : copy.recovering(recovering.length),
    detail: [label ?? copy.kinds[task.kind as keyof typeof copy.kinds] ?? copy.title, task.device ? copy.devices[task.device] : null].filter(Boolean).join(' · '),
  }
}
