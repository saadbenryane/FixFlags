import { Prisma } from '@prisma/client'
import { outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { prisma } from '@/lib/db'
import { confirmedOutcomeFlagSql, outcomeReceiptJoins } from './outcome-receipt-sql'

type FlagReference = { id: string; projectId: string | null; fingerprint?: string | null }
const confirmedOutcomeFlagJoins = Prisma.sql`
  JOIN outcome_assessments source ON source."auditId" = f."auditId"
  ${outcomeReceiptJoins}
  JOIN site_outcomes owner ON owner.id = source."outcomeId" AND owner."projectId" = request."projectId"
`

/** Raw bound findings remain readable by capture ID. Current attention and
 * new repair declarations need the exact committed failure on their Site. */
export async function loadConfirmedOutcomeFlagIds(flags: readonly FlagReference[],
  db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma): Promise<Set<string>> {
  const targets = flags.flatMap(flag => {
    const owner = outcomeFlagOwner(flag.fingerprint)
    return owner && flag.projectId ? [{ ...owner, id: flag.id, projectId: flag.projectId, fingerprint: flag.fingerprint }] : []
  })
  if (!targets.length) return new Set()
  const rows = await db.$queryRaw<Array<{ id: string }>>`
    SELECT DISTINCT f.id
    FROM jsonb_to_recordset(${JSON.stringify(targets)}::jsonb)
      AS target(id text, "projectId" text, "outcomeId" text, "bindingKey" text, fingerprint text)
    JOIN flags f ON f.id = target.id AND f.fingerprint = target.fingerprint
    ${confirmedOutcomeFlagJoins}
    WHERE request."projectId" = target."projectId" AND source."outcomeId" = target."outcomeId"
      AND ${confirmedOutcomeFlagSql}
      AND NOT (f."checkId" IS NOT DISTINCT FROM 'outcome-availability-failed' AND owner.slug = 'page-loads'
        AND owner.kind = 'AVAILABILITY' AND EXISTS (
          SELECT 1 FROM outcome_binding_executions e
          JOIN outcome_execution_bindings b ON b."outcomeId" = e."outcomeId" AND b.key = e."bindingKey"
          WHERE e."auditId" = f."auditId" AND e."outcomeId" = owner.id AND e."bindingKey" = target."bindingKey"
            AND b.mechanism = 'HTTP_AVAILABILITY' AND e.mechanism = b.mechanism AND e.disposition = 'FAILED'
            AND e.detail->>'failureFlagId' = f.id AND e."bindingVersion" < b.version
        ))
  `
  return new Set(rows.map(row => row.id))
}

/** An incident link can still open its last confirmed source after recovery. */
export async function latestConfirmedOutcomeFlagId(input: { projectId: string; outcomeId: string; improvementId: string }) {
  const [flag] = await prisma.$queryRaw<Array<{ id: string }>>`
    SELECT f.id
    FROM improvement_occurrences member
    JOIN flags f ON f.id = member."flagId" AND f."auditId" = member."auditId"
    JOIN improvements i ON i.id = member."improvementId" AND i."projectId" = ${input.projectId} AND i."outcomeId" = ${input.outcomeId}
    ${confirmedOutcomeFlagJoins}
    WHERE member."improvementId" = ${input.improvementId} AND request."projectId" = ${input.projectId}
      AND source."outcomeId" = ${input.outcomeId} AND ${confirmedOutcomeFlagSql}
    ORDER BY f."createdAt" DESC, f.id DESC LIMIT 1
  `
  return flag?.id ?? null
}
