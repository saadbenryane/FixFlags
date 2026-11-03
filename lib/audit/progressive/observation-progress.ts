import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { capturePageKey } from '../browser/observation-scope'
import { jsonValueSchema, readArtifact, serializeArtifact, TaskFailure, type TaskArtifact, type TaskKind } from './contracts'
import type { TaskContext } from './registry'
import { prisma } from '@/lib/db'
import { canonicalIntent } from '@/lib/sites/domain/execution-spec'

export const OBSERVATION_TARGET = 'artifact:observation'
export const OBSERVATION_COHORT_TARGET = 'intent:observation-cohort'
// Historical flow receipts retain their existing identity and evidence.
export const OBSERVATION_TARGETS = [OBSERVATION_TARGET, 'artifact:flow-control'] as const
const progressFields = { version: z.literal(1), batchSize: z.number().int().positive().max(5000), completed: z.number().int().positive().max(5000) }
const inlineProgressSchema = z.object({ ...progressFields, members: z.array(jsonValueSchema).min(1).max(5000) }).strict()
const referencedProgressSchema = z.object({ ...progressFields, cohortId: z.string().min(1), total: z.number().int().positive().max(5000) }).strict()
export const observationProgressSchema = z.union([inlineProgressSchema, referencedProgressSchema])
  .refine(progress => progress.completed <= observationTotal(progress), 'Observation progress exceeds its cohort')
export type ObservationProgress = z.infer<typeof observationProgressSchema>
const cohortSchema = z.object({ version: z.literal(1), kind: z.literal('observation-cohort'), workKind: z.string(),
  pageUrl: z.string().url(), batchSize: progressFields.batchSize, members: inlineProgressSchema.shape.members }).strict()
export function observationTotal(progress: z.infer<typeof inlineProgressSchema> | z.infer<typeof referencedProgressSchema>) {
  return 'members' in progress ? progress.members.length : progress.total
}

/** The first committed observation freezes the cohort. Later deliveries use
 * that checkpoint, rather than rediscovering routes or replaying earlier work. */
export async function nextObservationBatch<T>(context: TaskContext, kind: TaskKind, schema: z.ZodType<T>,
  load: () => Promise<T[]>, size: number) {
  if (!Number.isInteger(size) || size < 1 || size > 5000) throw new TaskFailure('OBSERVATION_BATCH_INVALID', false)
  const previous = context.task.workResult == null ? null : readArtifact(context.task.workResult, kind).data.observationProgress
  const prior = previous == null ? null : observationProgressSchema.parse(previous)
  const original: unknown = prior && 'members' in prior ? prior.members : undefined
  if (prior && 'cohortId' in prior) {
    if (prior.batchSize !== size || prior.completed >= prior.total) throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
    const completed = Math.min(prior.total, prior.completed + size)
    // Transfer only the next bounded slice, not the full retained control history.
    const rows = await prisma.$queryRaw<Array<{ total: number; members: unknown }>>`
      SELECT jsonb_array_length(CASE WHEN jsonb_typeof(detail->'members') = 'array' THEN detail->'members' ELSE '[]'::jsonb END) AS total,
        COALESCE((SELECT jsonb_agg(member.value ORDER BY member.ordinality)
          FROM jsonb_array_elements(CASE WHEN jsonb_typeof(detail->'members') = 'array' THEN detail->'members' ELSE '[]'::jsonb END)
            WITH ORDINALITY member(value, ordinality)
          WHERE member.ordinality > ${prior.completed} AND member.ordinality <= ${completed}), '[]'::jsonb) AS members
      FROM audit_verifier_executions WHERE id = ${prior.cohortId} AND "auditId" = ${context.audit.id}
        AND "taskId" = ${context.task.id} AND "scopeKey" = ${context.task.id} AND "targetKey" = ${OBSERVATION_COHORT_TARGET}
        AND status = 'COMPLETED' AND detail->'version' = '1'::jsonb AND detail->>'kind' = 'observation-cohort'
        AND detail->>'workKind' = ${kind} AND detail->>'pageUrl' = ${context.input.pageUrl}
        AND detail->'batchSize' = to_jsonb(${size}::int) LIMIT 1`
    const selected = rows[0]
    if (!selected || selected.total !== prior.total)
      throw new TaskFailure('OBSERVATION_COHORT_UNAVAILABLE', false)
    const members = z.array(schema).length(completed - prior.completed).parse(selected.members)
    return { members, progress: { ...prior, completed } as ObservationProgress, start: prior.completed }
  }
  if (prior && prior.batchSize !== size) throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
  const members = z.array(schema).max(5000).parse(prior ? original : await load())
  const start = prior?.completed ?? 0, completed = Math.min(members.length, start + size)
  if (prior && start >= members.length) throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
  const progress = prior || members.length > size
    ? observationProgressSchema.parse(JSON.parse(JSON.stringify({ version: 1, batchSize: size, members, completed }))) : undefined
  return { members: members.slice(start, completed), progress, start }
}

export function observationArtifact(kind: TaskKind, data: object, progress?: ObservationProgress): TaskArtifact {
  const artifact = serializeArtifact(kind, { ...data, ...(progress ? { observationProgress: progress } : {}) })
  return { ...artifact, ...(progress && progress.completed < observationTotal(progress) ? { continuation: true as const } : {}) }
}

/** Observation receipt and checkpoint are written in the engine's task-owner
 * transaction. Every batch keeps its evidence after a later delivery fails. */
export async function commitObservation(context: TaskContext, artifact: TaskArtifact, tx: Prisma.TransactionClient, scope: string) {
  const raw = artifact.data.observationProgress
  let recorded = artifact
  if (raw != null) {
    const progress = observationProgressSchema.parse(raw)
    if ('members' in progress) {
      const detail = cohortSchema.parse({ version: 1, kind: 'observation-cohort', workKind: artifact.kind,
        pageUrl: context.input.pageUrl, batchSize: progress.batchSize, members: progress.members })
      const cohort = await tx.auditVerificationReceipt.upsert({ where: { auditId_targetKey_scopeKey: { auditId: context.audit.id,
        targetKey: OBSERVATION_COHORT_TARGET, scopeKey: context.task.id } },
      create: { auditId: context.audit.id, taskId: context.task.id, targetKey: OBSERVATION_COHORT_TARGET, scopeKey: context.task.id,
        source: 'EXECUTION', status: 'COMPLETED', pageUrl: context.input.pageUrl, detail }, update: {} })
      if (canonicalIntent(cohortSchema.parse(cohort.detail)) !== canonicalIntent(detail)) throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
      recorded = { ...artifact, data: { ...artifact.data, observationProgress: { version: 1, batchSize: progress.batchSize,
        cohortId: cohort.id, total: progress.members.length, completed: progress.completed } } }
    }
  }
  await tx.auditVerificationReceipt.upsert({ where: { auditId_targetKey_scopeKey: { auditId: context.audit.id,
    targetKey: OBSERVATION_TARGET, scopeKey: recorded.kind + ':' + capturePageKey(context.input.pageUrl) + ':' + scope } },
  create: { auditId: context.audit.id, taskId: context.task.id, targetKey: OBSERVATION_TARGET,
    scopeKey: recorded.kind + ':' + capturePageKey(context.input.pageUrl) + ':' + scope, source: 'EXECUTION',
    status: 'COMPLETED', pageUrl: context.input.pageUrl, executionGeneration: context.task.workGeneration,
    detail: recorded as Prisma.InputJsonValue }, update: {} })
  return recorded
}

export function observationBatchStart(context: TaskContext, artifact: TaskArtifact, size: number): number | null {
  const raw = artifact.data.observationProgress
  const previous = context.task.workResult == null ? null : readArtifact(context.task.workResult, artifact.kind).data.observationProgress
  if (raw == null) {
    if (previous != null) throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
    return null
  }
  const progress = observationProgressSchema.parse(raw)
  const prior = previous == null ? null : observationProgressSchema.parse(previous)
  const start = prior?.completed ?? 0
  const total = observationTotal(progress)
  if (progress.batchSize !== size || (!prior && (!('members' in progress) || total <= size)) || prior &&
    canonicalIntent({ ...prior, completed: 0 }) !== canonicalIntent({ ...progress, completed: 0 }) ||
    progress.completed !== Math.min(start + size, total) || start >= total ||
    Boolean(artifact.continuation) !== (progress.completed < total))
    throw new TaskFailure('OBSERVATION_CHECKPOINT_INVALID', false)
  return start
}
