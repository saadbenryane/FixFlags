import type {
  ImprovementCycleEventType,
  ImprovementRejectionReason,
  Prisma,
  VerificationOutcome,
} from '@prisma/client'
import { prisma } from '@/lib/db'

type DbClient = typeof prisma | Prisma.TransactionClient

export type CycleEventInput = {
  projectId: string
  improvementId: string
  occurrenceId?: string | null
  sourceAuditId: string
  idempotencyKey: string
  type: ImprovementCycleEventType
  transport: string
  client?: string | null
  actor?: string | null
  attemptId?: string | null
  verificationAuditId?: string | null
  outcome?: VerificationOutcome | null
  rejectionReason?: ImprovementRejectionReason | null
  rejectionNote?: string | null
  revisitAt?: Date | null
  contextCorrection?: Prisma.InputJsonValue
  occurredAt?: Date
}

/** Appends a durable cycle event. Repeating the same semantic action is idempotent. */
export async function appendImprovementCycleEvent(
  input: CycleEventInput,
  db: DbClient = prisma,
) {
  const cycle = await db.improvementCycle.upsert({
    where: {
      improvementId_sourceAuditId: {
        improvementId: input.improvementId,
        sourceAuditId: input.sourceAuditId,
      },
    },
    create: {
      projectId: input.projectId,
      improvementId: input.improvementId,
      occurrenceId: input.occurrenceId,
      sourceAuditId: input.sourceAuditId,
    },
    update: input.occurrenceId ? { occurrenceId: input.occurrenceId } : {},
    select: { id: true },
  })
  return db.improvementCycleEvent.upsert({
    where: {
      cycleId_idempotencyKey: { cycleId: cycle.id, idempotencyKey: input.idempotencyKey },
    },
    create: {
      cycleId: cycle.id,
      idempotencyKey: input.idempotencyKey,
      type: input.type,
      transport: input.transport,
      client: input.client,
      actor: input.actor,
      attemptId: input.attemptId,
      verificationAuditId: input.verificationAuditId,
      outcome: input.outcome,
      rejectionReason: input.rejectionReason,
      rejectionNote: input.rejectionNote,
      revisitAt: input.revisitAt,
      contextCorrection: input.contextCorrection,
      occurredAt: input.occurredAt,
    },
    update: {
      transport: input.transport,
      client: input.client,
      actor: input.actor,
      attemptId: input.attemptId,
      verificationAuditId: input.verificationAuditId,
      outcome: input.outcome,
      rejectionReason: input.rejectionReason,
      rejectionNote: input.rejectionNote,
      revisitAt: input.revisitAt,
      contextCorrection: input.contextCorrection,
    },
  })
}

/** Publish observed generation in bounded batches without recording a customer action. */
export async function appendGeneratedImprovementCycleEvents(inputs: Array<Pick<CycleEventInput,
  'projectId' | 'improvementId' | 'occurrenceId' | 'sourceAuditId' | 'idempotencyKey' | 'transport' | 'client' | 'actor'>>,
  db: DbClient = prisma) {
  for (let offset = 0; offset < inputs.length; offset += 500) {
    const batch = inputs.slice(offset, offset + 500)
    const key = (row: { improvementId: string; sourceAuditId: string }) => JSON.stringify([row.improvementId, row.sourceAuditId])
    const unique = [...new Map(batch.map(row => [key(row), row])).values()]
    await db.improvementCycle.createMany({ data: unique.map(row => ({ projectId: row.projectId,
      improvementId: row.improvementId, occurrenceId: row.occurrenceId, sourceAuditId: row.sourceAuditId })), skipDuplicates: true })
    const cycles = await db.improvementCycle.findMany({ where: { OR: unique.map(row => ({
      improvementId: row.improvementId, sourceAuditId: row.sourceAuditId,
    })) }, select: { id: true, improvementId: true, sourceAuditId: true } })
    const byKey = new Map(cycles.map(row => [key(row), row.id]))
    const data = batch.map(row => {
      const cycleId = byKey.get(key(row))
      if (!cycleId) throw new Error('Observed Flag cycle was not published')
      return { cycleId, idempotencyKey: row.idempotencyKey, type: 'GENERATED' as const,
        transport: row.transport, client: row.client, actor: row.actor }
    })
    await db.improvementCycleEvent.createMany({ data, skipDuplicates: true })
  }
}

