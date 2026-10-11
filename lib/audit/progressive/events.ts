import type { Prisma } from '@prisma/client'
import { executionTransaction } from '../execution-ownership'

export async function recordProgress(tx: Prisma.TransactionClient, auditId: string, input: {
  taskId?: string; kind: string; state: string; observationReference?: string;
}) {
  // Public event transports serialize this notice, never collector payloads or raw logs.
  return tx.auditPipelineEvent.create({ data: {
    auditId, executionId: auditId + ':progressive', traceId: auditId, attempt: 1,
    stage: 'checking', event: 'projection_changed', status: 'info',
    detail: { version: 1, kind: input.kind, state: input.state, taskId: input.taskId ?? null,
      observationReference: input.observationReference ?? null },
  } })
}
export function publishProgress(auditId: string, input: Parameters<typeof recordProgress>[2]) {
  return executionTransaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "audits" WHERE "id" = ${auditId} FOR UPDATE`
    return recordProgress(tx, auditId, input)
  })
}
