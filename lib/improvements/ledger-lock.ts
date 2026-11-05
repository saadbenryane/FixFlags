import type { Prisma } from '@prisma/client'

/** Serialize changes to one durable Improvement before reading mutable facts.
 * Identity initialization may insert a row, but must not update an existing row
 * before taking this lock. */
export async function lockImprovementLedger(tx: Prisma.TransactionClient, improvementId: string) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${'fixflags:improvement-attempt:' + improvementId}, 0))`
}
