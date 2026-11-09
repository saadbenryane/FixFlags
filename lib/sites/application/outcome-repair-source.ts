import type { Prisma } from '@prisma/client'
import { confirmedOutcomeFlagSql, outcomeReceiptJoins } from './outcome-receipt-sql'
import { historicalCheckoutCaptureJoin, withHistoricalCheckoutDestination, type HistoricalCheckoutCapture } from './checkout-capture'
import { outcomeFlagOwner } from '@/lib/audit/flag-identity'

type OutcomeRepairIdentity = { projectId: string; sourceAuditId: string; outcomeId: string }
type OutcomeRepairAttempt = { improvementId: string; handoffReference: string | null; sourceFlagIds: string[] }

export async function loadSelectedOutcomeRepairSource(
  db: Pick<Prisma.TransactionClient, '$queryRaw' | 'improvementOccurrence'>,
  input: OutcomeRepairIdentity,
  attempt: OutcomeRepairAttempt,
) {
  const named = attempt.handoffReference?.startsWith('flag:') ? attempt.handoffReference.slice(5) : null
  const occurrences = named === null ? await db.improvementOccurrence.findMany({
    where: { improvementId: attempt.improvementId, auditId: input.sourceAuditId, audit: { projectId: input.projectId },
      ...(attempt.sourceFlagIds.length ? { flagId: { in: attempt.sourceFlagIds } } : {}) },
    select: { flagId: true }, take: 2,
  }) : []
  const flagId = named ?? (occurrences.length === 1 ? occurrences[0].flagId : null)
  return flagId ? loadOutcomeRepairSource(db, { ...input, flagId, improvementId: attempt.improvementId }) : null
}

/** Admission and settlement use the same failed assessment. The assessment
 * must name the selected Flag, including legacy binding execution references. */
export async function loadOutcomeRepairSource(db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  input: OutcomeRepairIdentity & { improvementId: string; flagId: string }) {
  const [source] = await db.$queryRaw<Array<{ state: 'FLAG'; coverage: Prisma.JsonValue; kind: string;
    fingerprint: string | null; capture: HistoricalCheckoutCapture | null }>>`
    SELECT source.state, source.coverage, owner.kind, f.fingerprint, legacy_checkout.capture
    FROM outcome_assessments source ${outcomeReceiptJoins}
    JOIN site_outcomes owner ON owner.id = source."outcomeId" AND owner."projectId" = request."projectId"
    JOIN flags f ON f.id = ${input.flagId} AND f."auditId" = source."auditId"
    JOIN improvement_occurrences member ON member."flagId" = f.id AND member."auditId" = f."auditId"
      AND member."improvementId" = ${input.improvementId}
    JOIN improvements i ON i.id = member."improvementId" AND i."projectId" = request."projectId" AND i."outcomeId" = owner.id
    ${historicalCheckoutCaptureJoin}
    WHERE request."projectId" = ${input.projectId} AND source."auditId" = ${input.sourceAuditId}
      AND source."outcomeId" = ${input.outcomeId} AND ${confirmedOutcomeFlagSql}
    ORDER BY request."requestedAt" DESC, source."assessedAt" DESC, source.id DESC LIMIT 1
  `
  if (!source) return null
  const owner = outcomeFlagOwner(source.fingerprint)
  return { state: source.state, kind: source.kind, bindingKey: owner?.outcomeId === input.outcomeId ? owner.bindingKey : undefined,
    coverage: withHistoricalCheckoutDestination(source.coverage, source.capture) }
}
