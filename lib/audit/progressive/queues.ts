import type { TaskKind, TaskInput } from './contracts'
import { browserCapacity, publicHttpCapacity, configuredLimit } from './capacity'
import { Prisma } from '@prisma/client'

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
export function priorityForTask(kind: TaskKind, input: TaskInput, attempts = 0): number {
  if (kind === 'prescription') return 1
  // A slow provider retry must not overtake untried linked-page measurements.
  // Bound the persisted attempt count to BullMQ's supported priority range.
  if (kind === 'pagespeed') return Math.min(500_000, Math.max(0, Math.floor(attempts))) * 4 + (input.primary ? 1 : 3)
  if (['pagespeed', 'google', 'judge'].includes(kind)) return input.primary ? 1 : 3
  if (queueForTask(kind, input) === 'browser') return input.primary ? 1 : 3
  return kind === 'http' ? 1 : kind === 'check' ? 2 : 3
}
// First matching rule owns routing for both delivery and capacity accounting.
const routing: Array<{ kinds: TaskKind[]; modules?: string[]; queue: TaskQueue }> = [
  { kinds: ['bindings'], modules: ['HTTP_AVAILABILITY'], queue: 'availability' },
  { kinds: ['browser', 'motion', 'overlays', 'keyboard', 'captures', 'flow', 'slow-replay', 'journeys', 'bindings', 'fixture-setup', 'automatic-accounts'], queue: 'browser' },
  { kinds: ['pagespeed'], queue: 'pagespeed' }, { kinds: ['google'], queue: 'google' },
  { kinds: ['judge', 'prescription'], queue: 'provider' },
  { kinds: ['search'], modules: ['search-canonical'], queue: 'http' },
  // Destination requests use HTTP capacity, keeping local evaluation independent.
  { kinds: ['check'], modules: ['og-image', 'auth-checkout', 'seo'], queue: 'http' },
  { kinds: ['http', 'search-resources', 'discovery'], queue: 'http' },
]
export function queueForTask(kind: TaskKind, input: TaskInput): TaskQueue {
  return routing.find(rule => rule.kinds.includes(kind) && (!rule.modules || rule.modules.includes(input.module ?? '')))?.queue ?? 'evaluate'
}
/** Fixed delivery alias, never interpolated from a caller. */
export const deliveryResourceSql = Prisma.sql`CASE ${Prisma.join(routing.map(rule => Prisma.sql`
  WHEN delivery."workKind" IN (${Prisma.join(rule.kinds)})
    ${rule.modules ? Prisma.sql`AND delivery."workInput"->>'module' IN (${Prisma.join(rule.modules)})` : Prisma.empty}
  THEN ${rule.queue}`), ' ')} ELSE 'evaluate' END`

/** Small independent delivery windows bound live deliveries as well as workers.
 * Additional admitted work remains in the existing database task ledger. */
export function taskDeliveryWindow(resource: TaskQueue): number {
  return Math.max(8, TASK_QUEUES[resource].concurrency * 4)
}
