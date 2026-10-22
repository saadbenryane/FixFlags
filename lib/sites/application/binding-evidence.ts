import { executionWrite, executionTransaction, currentExecutionOwnership } from '@/lib/audit/execution-ownership'
import type { OutcomeExecutionMechanism, Prisma } from '@prisma/client'
import { TaskFailure } from '@/lib/audit/progressive/contracts'
import type { BindingDispositionName } from './binding-assessment'

export type BindingObservation = {
  disposition: BindingDispositionName
  reason: string
  detail?: Prisma.InputJsonObject
}

/**
 * Persist the conclusive verdict as the latest-attempt projection and append every
 * confirmation attempt that produced it. A failure a later attempt recovered stays
 * recorded and is marked transient, so flakiness remains diagnosable instead of
 * being overwritten, and it never reaches the customer as a Flag.
 */
export async function recordBindingEvidence(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  mechanism: OutcomeExecutionMechanism
  attempts: BindingObservation[]
  conclusive: BindingObservation
  flag?: Prisma.FlagUncheckedCreateInput
  failureFlagId?: string
}): Promise<void> {
  const { auditId, outcomeId, bindingKey, mechanism, conclusive } = input
  if (currentExecutionOwnership()?.taskId && ['request_failed', 'rendered_surface_unavailable', 'form_execution_failed', 'probe_error'].includes(conclusive.reason)) {
    await executionWrite(tx => tx.auditPipelineEvent.create({ data: {
      auditId, executionId: currentExecutionOwnership()!.taskId!, traceId: auditId,
      attempt: currentExecutionOwnership()!.generation, stage: 'checking', event: 'binding_attempt_interrupted', status: 'partial',
      detail: { version: 1, outcomeId, bindingKey, bindingVersion: input.bindingVersion ?? null, observations: input.attempts as Prisma.InputJsonValue },
    } }))
    throw new TaskFailure('BINDING_EXECUTION_INTERRUPTED', true)
  }
  await executionTransaction(async tx => {
  await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
  const existing = await tx.outcomeBindingExecution.findUnique({
    where: { auditId_outcomeId_bindingKey: { auditId, outcomeId, bindingKey } }, select: { id: true },
  })
  if (existing) return
  const generation = currentExecutionOwnership()?.generation
  const flag = input.flag ? await tx.flag.create({ data: input.flag }) : null
  const failureFlagId = flag?.id ?? input.failureFlagId
  const execution = await tx.outcomeBindingExecution.create({
    data: {
      auditId,
      outcomeId,
      bindingKey,
      mechanism,
      disposition: conclusive.disposition,
      reason: conclusive.reason,
      detail: failureFlagId ? { ...conclusive.detail, failureFlagId } : conclusive.detail,
      bindingVersion: input.bindingVersion,
      executionGeneration: generation,
    },
  })
  // Continue the existing sequence so a restarted worker never reuses an attempt number.
  const last = await tx.outcomeBindingAttempt.findFirst({
    where: { auditId, outcomeId, bindingKey },
    orderBy: { attempt: 'desc' },
    select: { attempt: true },
  })
  const startAt = (last?.attempt ?? 0) + 1
  await tx.outcomeBindingAttempt.createMany({
    data: input.attempts.map((observation, index) => ({
      auditId,
      outcomeId,
      bindingKey,
      attempt: startAt + index,
      bindingVersion: input.bindingVersion,
      executionGeneration: generation,
      mechanism,
      disposition: observation.disposition,
      reason: observation.reason,
      detail: observation.detail,
      executionId: execution.id,
    })),
  })
  if (input.attempts.some((observation) => observation.disposition === 'SUCCEEDED')) {
    await tx.outcomeBindingAttempt.updateMany({
      where: { auditId, outcomeId, bindingKey, disposition: 'FAILED', transient: false },
      data: { transient: true },
    })
  }
  await tx.auditPipelineEvent.create({ data: {
    auditId, executionId: execution.id, traceId: auditId, attempt: startAt,
    stage: 'checking', event: 'binding_observation_committed', status: 'completed',
    detail: { version: 1, outcomeId, bindingKey, bindingVersion: input.bindingVersion ?? null,
      generation: generation ?? null, observations: input.attempts as Prisma.InputJsonValue },
  } })
  })
}

/** Record one conclusive observation that required no confirmation attempt. */
export async function recordExecution(input: {
  auditId: string
  outcomeId: string
  bindingKey: string
  bindingVersion?: number
  mechanism: OutcomeExecutionMechanism
  disposition: BindingDispositionName
  reason: string
  detail?: Prisma.InputJsonObject
}): Promise<void> {
  const observation: BindingObservation = {
    disposition: input.disposition,
    reason: input.reason,
    detail: input.detail,
  }
  await recordBindingEvidence({
    auditId: input.auditId,
    outcomeId: input.outcomeId,
    bindingKey: input.bindingKey,
    bindingVersion: input.bindingVersion,
    mechanism: input.mechanism,
    attempts: [observation],
    conclusive: observation,
  })
}
