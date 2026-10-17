import type { TaskKind, TaskInput } from './contracts'
import { browserCapacity, publicHttpCapacity, configuredLimit } from './capacity'

export const TASK_QUEUES = {
  http: { name: 'audit-task-http', concurrency: publicHttpCapacity.capacity },
  browser: { name: 'audit-task-browser', concurrency: browserCapacity.capacity },
  pagespeed: { name: 'audit-task-pagespeed', concurrency: configuredLimit('AUDIT_PAGESPEED_CONCURRENCY', 2) },
  google: { name: 'audit-task-google', concurrency: configuredLimit('AUDIT_GOOGLE_CONCURRENCY', 2) },
  // Retain this queue for AI and deliveries published before resource isolation.
  provider: { name: 'audit-task-provider', concurrency: configuredLimit('AUDIT_PROVIDER_CONCURRENCY', 2) },
  evaluate: { name: 'audit-task-evaluate', concurrency: configuredLimit('AUDIT_EVALUATOR_CONCURRENCY', 2) },
  availability: { name: 'audit-task-availability', concurrency: 1 },
} as const
export type TaskQueue = keyof typeof TASK_QUEUES
/** Prioritize queued primary-page work over linked documents. Active graphs are
 * bounded, so linked work retains a finite cohort. */
export function priorityForTask(kind: TaskKind, input: TaskInput): number {
  if (kind === 'prescription') return 1
  if (['pagespeed', 'google', 'judge'].includes(kind)) return input.primary ? 1 : 3
  if (queueForTask(kind, input) === 'browser') return input.primary ? 1 : 3
  return kind === 'http' ? 1 : kind === 'check' ? 2 : 3
}
export function queueForTask(kind: TaskKind, input: TaskInput): TaskQueue {
  if (kind === 'bindings' && input.module === 'HTTP_AVAILABILITY') return 'availability'
  if (['browser', 'motion', 'overlays', 'keyboard', 'captures', 'flow', 'slow-replay', 'journeys', 'bindings', 'fixture-setup', 'automatic-accounts'].includes(kind)) return 'browser'
  if (kind === 'pagespeed') return 'pagespeed'
  if (kind === 'google') return 'google'
  if (['judge', 'prescription'].includes(kind)) return 'provider'
  if (kind === 'search' && input.module === 'search-canonical') return 'http'
  if (['http', 'search-resources', 'discovery'].includes(kind)) return 'http'
  return 'evaluate'
}
