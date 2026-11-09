import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { readOutcomeRecovery } from '@/lib/sites/domain/outcome-incident'
import { confirmedOutcomeFlagSql, outcomeReceiptJoins, supersededOutcomeReceiptSql } from '@/lib/sites/application/outcome-receipt-sql'
import { calculateOutcomeRecoveryValue, type OutcomeFailure, type OutcomeObservation } from './outcome-recovery-value'

const LIMIT = 5_000
type RetainedReceipt = { runRequestId: string }
const observationColumns = Prisma.sql`
  source."auditId", source."outcomeId", source."runRequestId", request."projectId", owner.kind::text, source.state::text, request.source::text,
  request."requestedAt", request."completedAt", source.coverage,
  jsonb_build_object('incident', source.evidence->'incident') AS evidence
`
const observationJoins = Prisma.sql`
  ${outcomeReceiptJoins}
  JOIN site_outcomes owner ON owner.id = source."outcomeId" AND owner."projectId" = request."projectId"
    AND owner.environment = request.environment
  JOIN projects site ON site.id = request."projectId" AND site."deletedAt" IS NULL AND site."userId" = observed."userId"
`
const settledProductionReceipt = Prisma.sql`
  request.environment = 'production' AND request.status = 'COMPLETED' AND observed.status = 'COMPLETED'
    AND observed."startedAt" >= request."requestedAt" AND observed."completedAt" >= observed."startedAt"
    AND source."assessedAt" BETWEEN observed."startedAt" AND request."completedAt"
    AND request."completedAt" >= observed."completedAt" AND NOT (${supersededOutcomeReceiptSql})
`

/** Reuse the native receipt join inside the caller's read-only snapshot. */
export async function readOutcomeRecoveryEvidence(tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  { since, now, projectIds, availabilityAuditIds }: {
    since: Date; now: Date; projectIds?: string[]; availabilityAuditIds?: string[]
  }) {
  if (projectIds?.length === 0 || availabilityAuditIds?.length === 0) return { observations: [], failures: [] }
  const siteScope = projectIds ? Prisma.sql`AND request."projectId" = ANY(${projectIds}::text[])` : Prisma.empty
  const auditScope = availabilityAuditIds
    ? Prisma.sql`AND owner.kind = 'AVAILABILITY' AND observed.id = ANY(${availabilityAuditIds}::text[])` : Prisma.empty
  const observations = await tx.$queryRaw<Array<OutcomeObservation & RetainedReceipt>>`
      SELECT ${observationColumns}
      FROM outcome_assessments source ${observationJoins}
      WHERE ${settledProductionReceipt} AND request."completedAt" BETWEEN ${since} AND ${now} ${siteScope} ${auditScope}
      ORDER BY request."completedAt", request.id, source.id
      LIMIT ${LIMIT + 1}
  `
  if (observations.length > LIMIT) throw new Error('Outcome recovery cohort exceeds reporting limit')
  const flagIds = [...new Set(observations.flatMap(row => readOutcomeRecovery(row.evidence, row.state)?.recoveredFlagIds ?? []))]
  if (flagIds.length > LIMIT) throw new Error('Outcome recovery cohort exceeds reporting limit')
  const failures = flagIds.length ? await tx.$queryRaw<Array<OutcomeFailure & RetainedReceipt>>`
      SELECT ${observationColumns}, f.id AS "flagId", f.fingerprint, f."resolvedInId"
      FROM outcome_assessments source ${observationJoins}
      JOIN flags f ON f."auditId" = source."auditId"
      WHERE ${settledProductionReceipt} AND ${confirmedOutcomeFlagSql}
        AND f.id = ANY(${flagIds}::text[]) AND f.status = 'FIXED' AND f."resolvedInId" IS NOT NULL
        AND request."completedAt" <= ${now} ${siteScope} ${auditScope}
      LIMIT ${LIMIT + 1}
  ` : []
  if (failures.length > LIMIT) throw new Error('Outcome failure lineage exceeds reporting limit')
  return { observations, failures }
}

/** Test coverage of retained scheduled receipts without fetching excluded evidence. */
export async function hasUncoveredScheduledRecoveryReceipt(tx: Pick<Prisma.TransactionClient, '$queryRaw'>,
  windows: ReadonlyMap<OutcomeObservation, Date>, eligible: Array<RetainedReceipt & { outcomeId: string }>) {
  if (!windows.size) return false
  const bounds = Array.from(windows, ([recovery, end]) => ({
    projectId: recovery.projectId, outcomeId: recovery.outcomeId, auditId: recovery.auditId,
    recoveredAt: recovery.completedAt, end,
  }))
  const [result] = await tx.$queryRaw<Array<{ uncovered: boolean }>>`
    SELECT EXISTS (
      SELECT 1
      FROM outcome_assessments source ${observationJoins}
      JOIN jsonb_to_recordset(${JSON.stringify(bounds)}::jsonb)
        AS bounds("projectId" text, "outcomeId" text, "auditId" text, "recoveredAt" timestamp, "end" timestamp)
        ON bounds."projectId" = request."projectId" AND bounds."outcomeId" = source."outcomeId"
        AND bounds."auditId" <> source."auditId"
        AND request."requestedAt" > bounds."recoveredAt" AND request."completedAt" <= bounds."end"
      WHERE ${settledProductionReceipt} AND request.source = 'WATCH' AND owner.kind = 'AVAILABILITY'
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_to_recordset(${JSON.stringify(eligible)}::jsonb)
            AS eligible("runRequestId" text, "outcomeId" text)
          WHERE eligible."runRequestId" = source."runRequestId" AND eligible."outcomeId" = source."outcomeId"
        )
    ) AS uncovered
  `
  return result.uncovered
}

export async function loadOutcomeRecoveryValue(
  input: { since: Date; now?: Date }, db: Pick<typeof prisma, '$transaction'> = prisma,
) {
  const now = input.now ?? new Date()
  if (!Number.isFinite(input.since.getTime()) || !Number.isFinite(now.getTime()) || input.since > now) {
    throw new Error('Invalid Outcome recovery window')
  }
  return db.$transaction(async tx => {
    await tx.$executeRaw`SET TRANSACTION READ ONLY`
    const evidence = await readOutcomeRecoveryEvidence(tx, { since: input.since, now })
    return calculateOutcomeRecoveryValue({ since: input.since, now, ...evidence })
  }, { isolationLevel: 'RepeatableRead' })
}
