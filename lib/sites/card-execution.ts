import { CHECK_MODULE_AREAS } from '@/lib/audit/checks/module-areas'
import type { ExecutionProgress } from '@/lib/sites/application/execution-progress'
import type { SiteCardArea } from '@/lib/sites/card-areas'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

type Task = ExecutionProgress['tasks'][number]
export type CategoryActivity = Partial<Record<SiteCardArea, Pick<Task, 'kind' | 'module' | 'device'> & {
  state: 'RUNNING' | 'RETRY_WAIT' | 'WAITING' | 'READY'
}>>

export function taskArea(task: Pick<Task, 'kind' | 'module'>): SiteCardArea | null {
  if (task.kind === 'search' || task.kind === 'search-resources' || task.kind === 'google') return 'search'
  if (task.kind === 'pagespeed' || task.kind === 'slow-replay') return 'performance'
  if (task.kind === 'keyboard') return 'accessibility'
  if (task.kind === 'flow' || task.kind === 'journeys') return 'conversion'
  if (task.module && Object.hasOwn(CHECK_MODULE_AREAS, task.module)) return CHECK_MODULE_AREAS[task.module as keyof typeof CHECK_MODULE_AREAS]
  if (['http', 'browser', 'captures', 'discovery', 'cross-page'].includes(task.kind)) return 'site'
  return null
}

/** Keep category activity independent of the bounded detail list. Ties retain
 * recorded order, and running work takes precedence over recovery and waiting. */
export function categoryExecutionActivity(tasks: readonly Task[]): CategoryActivity {
  const activity: CategoryActivity = {}, rank = { RUNNING: 3, RETRY_WAIT: 2, WAITING: 1, READY: 1 }
  for (const task of tasks) {
    if (!Object.hasOwn(rank, task.state)) continue
    const area = taskArea(task), state = task.state as keyof typeof rank
    if (!area) continue
    const previous = activity[area]
    if (previous && rank[previous.state] >= rank[state]) continue
    activity[area] = { kind: task.kind, module: task.module, device: task.device, state }
  }
  return activity
}

export function cardExecution(area: SiteCardArea, progress: ExecutionProgress | null | undefined) {
  const copy = SITE_ACTION_COPY.execution
  const task = (progress?.categoryActivity ?? categoryExecutionActivity(progress?.tasks ?? []))[area]
  if (!task) return null
  const label = task.module ? copy.modules[task.module as keyof typeof copy.modules] : undefined
  return {
    status: task.state === 'RUNNING' ? copy.runningStatus : task.state === 'RETRY_WAIT' ? copy.retryingStatus : copy.waitingStatus,
    detail: [label ?? copy.kinds[task.kind as keyof typeof copy.kinds] ?? copy.title, task.device ? copy.devices[task.device] : null].filter(Boolean).join(' · '),
  }
}
