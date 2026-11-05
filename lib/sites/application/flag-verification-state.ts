import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { attemptHasActiveVerification } from '@/lib/improvements/attempt-state'
import { flagVerificationFeedback, type FlagVerificationFeedback } from '../flag-resolution'

type Target = { id: string; auditId: string; improvementId?: string | null; createdAt?: Date }
type CurrentVerification = { verifying: boolean; feedback: FlagVerificationFeedback | null }
type Row = { flagId: string; outcome: string | null; comparable: boolean | null; verificationReason: string | null;
  sourceAuditId: string; sourceFlagIds: string[]; handoffReference: string | null; verificationAuditId: string;
  projectId: string; parentId: string; status: string; createdAt: Date; completedAt: Date | null; finalizeState: string | null }

/** Current check state belongs to actual admission, independently of how many
 * repair drafts precede it in the bounded display history. Reads remain scalar
 * and select at most one matching check per original Flag. */
export async function loadCurrentFlagVerifications(projectId: string, targets: readonly Target[],
  db: Pick<Prisma.TransactionClient, '$queryRaw'> = prisma) {
  const selected = targets.filter((target): target is Target & { improvementId: string } => Boolean(target.improvementId))
  const states = new Map<string, CurrentVerification>()
  for (let offset = 0; offset < selected.length; offset += 200) {
    const batch = selected.slice(offset, offset + 200)
    const rows = await db.$queryRaw<Row[]>`
      SELECT requested."flagId", current.* FROM unnest(${batch.map(item => item.id)}::text[],
        ${batch.map(item => item.auditId)}::text[], ${batch.map(item => item.improvementId)}::text[])
        requested("flagId", "sourceAuditId", "improvementId")
      JOIN flags captured ON captured.id = requested."flagId" AND captured."auditId" = requested."sourceAuditId"
      JOIN audits original ON original.id = captured."auditId" AND original."projectId" = ${projectId}
      JOIN LATERAL (
        SELECT attempt.outcome, attempt.comparable, attempt."verificationReason", attempt."sourceAuditId",
          CASE WHEN cardinality(attempt."sourceFlagIds") > 0 THEN ARRAY[requested."flagId"] ELSE '{}'::text[] END AS "sourceFlagIds",
          attempt."handoffReference", proof.id AS "verificationAuditId",
          proof."projectId", proof."parentId", proof.status, proof."createdAt", proof."completedAt",
          finalizer."workState" AS "finalizeState"
        FROM improvement_attempts attempt JOIN improvements incident ON incident.id = attempt."improvementId"
        JOIN audits proof ON proof.id = attempt."verificationAuditId" AND proof."projectId" = ${projectId}
          AND proof."parentId" = attempt."sourceAuditId"
        LEFT JOIN LATERAL (SELECT "workState" FROM audit_execution_tasks
          WHERE "auditId" = proof.id AND "workKind" = 'finalize' AND "workState" IN ('READY', 'RUNNING', 'RETRY_WAIT')
          ORDER BY "createdAt" DESC, id DESC LIMIT 1) finalizer ON true
        WHERE incident.id = requested."improvementId" AND incident."projectId" = ${projectId}
          AND (cardinality(attempt."sourceFlagIds") > 0 AND requested."flagId" = ANY(attempt."sourceFlagIds")
            OR cardinality(attempt."sourceFlagIds") = 0 AND attempt."sourceAuditId" = requested."sourceAuditId"
              AND (attempt."handoffReference" IS NULL OR attempt."handoffReference" NOT LIKE 'flag:%'
                OR attempt."handoffReference" = 'flag:' || requested."flagId"))
        ORDER BY proof."createdAt" DESC, proof.id DESC, attempt."createdAt" DESC, attempt.id DESC LIMIT 1
      ) current ON true`
    const byId = new Map(batch.map(target => [target.id, target]))
    for (const row of rows) {
      const target = byId.get(row.flagId)
      if (!target) continue
      const attempt = { ...row, verificationAudit: { id: row.verificationAuditId, projectId: row.projectId,
        parentId: row.parentId, status: row.status, createdAt: row.createdAt, completedAt: row.completedAt,
        verifierExecutions: row.finalizeState ? [{ workKind: 'finalize', workState: row.finalizeState }] : [] } }
      states.set(row.flagId, { verifying: attemptHasActiveVerification(attempt, projectId, target.auditId, target.id),
        feedback: flagVerificationFeedback({ projectId, sourceAuditId: target.auditId, sourceFlagId: target.id,
          observedAt: target.createdAt, attempts: [attempt] }) })
    }
  }
  return states
}
