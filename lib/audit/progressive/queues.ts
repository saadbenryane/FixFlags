import type { TaskKind, TaskInput } from './contracts'
import { browserCapacity, publicHttpCapacity, configuredLimit } from './capacity'

export const TASK_QUEUES = {
  http: { name: 'audit-task-http', concurrency: publicHttpCapacity.capacity },
  browser: { name: 'audit-task-browser', concurrency: browserCapacity.capacity },
  provider: { name: 'audit-task-provider', concurrency: configuredLimit('AUDIT_PROVIDER_CONCURRENCY', 2) },
  evaluate: { name: 'audit-task-evaluate', concurrency: configuredLimit('AUDIT_EVALUATOR_CONCURRENCY', 2) },
  availability: { name: 'audit-task-availability', concurrency: 1 },
} as const
export type TaskQueue = keyof typeof TASK_QUEUES
export function queueForTask(kind: TaskKind, input: TaskInput): TaskQueue {
  if (kind === 'bindings' && input.module === 'HTTP_AVAILABILITY') return 'availability'
  if (['browser', 'captures', 'flow', 'slow-replay', 'journeys', 'bindings', 'fixture-setup'].includes(kind)) return 'browser'
  if (['pagespeed', 'google', 'judge'].includes(kind)) return 'provider'
  if (kind === 'search' && input.module === 'search-canonical') return 'http'
  if (['http', 'search-resources', 'discovery'].includes(kind)) return 'http'
  return 'evaluate'
}
