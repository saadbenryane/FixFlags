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

