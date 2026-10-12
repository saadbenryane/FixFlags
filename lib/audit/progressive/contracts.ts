import { z } from 'zod'

export const ANALYSIS_RECOVERY_MS = 60 * 60_000
export const TASK_RECOVERY_MS = 30 * 60_000
export const MAX_TASKS_PER_AUDIT = 1200
export const TASK_CRASH_LIMIT = 3
export const MAX_ARTIFACT_BYTES = 16 * 1024 * 1024
export const taskKindSchema = z.enum(['http', 'search-resources', 'browser', 'keyboard', 'captures', 'pagespeed', 'check', 'search', 'google', 'flow', 'slow-replay', 'journeys', 'bindings', 'fixture-setup', 'automatic-accounts', 'judge', 'discovery', 'cross-page', 'finalize'])
export type TaskKind = z.infer<typeof taskKindSchema>
export const taskInputSchema = z.object({
  pageUrl: z.string().url(), position: z.number().int().nonnegative().max(23),
  primary: z.boolean(), role: z.string().min(1).max(80), module: z.string().min(1).max(120).optional(),
  outcomeId: z.string().min(1).max(120).optional(), bindingKey: z.string().min(1).max(120).optional(),
  fixtureId: z.string().min(1).max(120).optional(),
  device: z.enum(['desktop', 'mobile']).optional(),
}).strict()
export type TaskInput = z.infer<typeof taskInputSchema>
export const taskPlanSchema = z.object({
  kind: taskKindSchema, key: z.string().min(1).max(200), scope: z.string().min(1).max(2048),
  input: taskInputSchema, dependencies: z.array(z.string().min(1)).max(1200),
}).strict()
export type TaskPlan = z.infer<typeof taskPlanSchema>
export const taskJobSchema = z.object({ auditId: z.string().min(1), taskId: z.string().min(1),
  generation: z.number().int().positive() }).strict()
export const SETTLED_TASK_STATES = ['COMPLETED', 'BLOCKED', 'EXHAUSTED'] as const
export function taskIsSettled(state: string | null) { return SETTLED_TASK_STATES.some(value => value === state) }

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue }
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(), z.number().finite(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema),
]))
export const taskArtifactSchema = z.object({
  kind: taskKindSchema, version: z.literal(1), collectedAt: z.string().datetime(),
  data: z.record(z.string(), jsonValueSchema),
}).strict()
export type TaskArtifact = z.infer<typeof taskArtifactSchema>
export function serializeArtifact(kind: TaskKind, data: object): TaskArtifact {
  const serialized = JSON.stringify({ kind, version: 1, collectedAt: new Date().toISOString(), data })
  if (Buffer.byteLength(serialized) > MAX_ARTIFACT_BYTES) throw new TaskFailure('ARTIFACT_LIMIT', false)
  return taskArtifactSchema.parse(JSON.parse(serialized))
}
export function readArtifact(value: unknown, expected: TaskKind) {
  const artifact = taskArtifactSchema.parse(value)
  if (artifact.kind !== expected) throw new TaskFailure('ARTIFACT_KIND_MISMATCH', false)
  return artifact
}
export class TaskFailure extends Error {
  constructor(readonly code: string, readonly retryable: boolean, readonly retryAfterMs?: number, readonly crash = false) {
    super(code); this.name = 'TaskFailure'
  }
}
export function retryDecision(input: { now: number; admittedAt: number; firstFailureAt?: number; attempts: number;
  crash: boolean; retryable: boolean; retryAfterMs?: number; random?: number }) {
  const until = Math.min(input.admittedAt + ANALYSIS_RECOVERY_MS, (input.firstFailureAt ?? input.now) + TASK_RECOVERY_MS)
  const retry = input.retryable && input.now < until && (!input.crash || input.attempts < TASK_CRASH_LIMIT)
  const delay = Math.max(input.retryAfterMs ?? 0, Math.min(60_000, 5000 * 2 ** Math.min(8, Math.max(0, input.attempts - 1))) * (0.8 + 0.4 * (input.random ?? 0.5)))
  return { retry, until, nextAt: Math.min(until, input.now + delay) }
}
export function validateTaskGraph(plans: TaskPlan[]) {
  if (plans.length > MAX_TASKS_PER_AUDIT) throw new Error('Execution task limit exceeded')
  const byKey = new Map<string, TaskPlan>()
  for (const value of plans) {
    const task = taskPlanSchema.parse(value)
    if (byKey.has(task.key)) throw new Error('Duplicate task identity')
    byKey.set(task.key, task)
  }
  const visiting = new Set<string>(), visited = new Set<string>()
  function visit(key: string) {
    if (visiting.has(key)) throw new Error('Cyclic task dependency')
    if (visited.has(key)) return
    const task = byKey.get(key)
    if (!task) throw new Error('Missing task dependency')
    visiting.add(key); task.dependencies.forEach(visit); visiting.delete(key); visited.add(key)
  }
  byKey.forEach((_, key) => visit(key))
}
