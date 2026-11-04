import { prisma } from '@/lib/db'
import type { Prisma } from '@prisma/client'
import { attemptProvesFlagRecovery } from '@/lib/improvements/attempt-state'
import { incidentRecoveryFlagSelect, loadIncidentRecoveryProofs } from './incident-proofs'

type Target = { id: string; auditId: string; improvementId?: string; proofId?: string }
export type AcceptedFlagRecovery = { auditId: string; completedAt: Date | null }
type Row = { flagId: string; sourceAuditId: string; sourceFlagIds: string[]; handoffReference: string | null; verificationAuditId: string;
  outcome: string | null; comparable: boolean | null; capturedSource: boolean; projectId: string; parentId: string; status: string; completedAt: Date | null }
type RecoveryDatabase = Pick<Prisma.TransactionClient, '$queryRaw' | 'flag' | 'audit' | 'auditVerificationReceipt' | 'outcomeAssessment'>

/** Accepted recovery belongs to its selected sources. Frozen native selections
 * still require full comparison; legacy outcomes retain their original scope. */
export async function loadAcceptedFlagRecoveries(projectId: string, targets: readonly Target[],
  options: { database?: RecoveryDatabase; before?: Date } = {}) {
  const db = options.database ?? prisma
  const proven = new Map<string, AcceptedFlagRecovery>()
  for (let offset = 0; offset < targets.length; offset += 200) {
    let batch = targets.slice(offset, offset + 200)
    const skipped: string[] = []
    while (batch.length) {
      const rows = await db.$queryRaw<Row[]>`
        SELECT requested."flagId", recovery.* FROM unnest(${batch.map(row => row.id)}::text[],
          ${batch.map(row => row.auditId)}::text[], ${batch.map(row => row.improvementId ?? null)}::text[],
          ${batch.map(row => row.proofId ?? null)}::text[])
          requested("flagId", "sourceAuditId", "improvementId", "proofId")
        JOIN flags captured ON captured.id = requested."flagId" AND captured."auditId" = requested."sourceAuditId" AND captured.status = 'OPEN'
        JOIN audits source ON source.id = captured."auditId" AND source."projectId" = ${projectId}
        LEFT JOIN improvement_occurrences occurrence ON occurrence."flagId" = captured.id
        JOIN improvements incident ON incident."projectId" = ${projectId} AND (
          requested."improvementId" IS NOT NULL AND incident.id = requested."improvementId"
          OR requested."improvementId" IS NULL AND (occurrence."improvementId" = incident.id
            OR occurrence.id IS NULL AND captured.fingerprint = incident.fingerprint))
        JOIN LATERAL (
          SELECT attempt."sourceAuditId", attempt."handoffReference", attempt.outcome, attempt.comparable,
            CASE WHEN attempt."sourceObservations" IS NOT NULL AND cardinality(attempt."sourceFlagIds") > 0
              THEN ARRAY[requested."flagId"] ELSE '{}'::text[] END AS "sourceFlagIds",
            (attempt."sourceObservations" IS NOT NULL) AS "capturedSource", verification.id AS "verificationAuditId",
            verification."projectId", verification."parentId", verification.status, verification."completedAt"
          FROM improvement_attempts attempt
          JOIN audits attempt_source ON attempt_source.id = attempt."sourceAuditId" AND attempt_source."projectId" = ${projectId}
          JOIN audits verification ON verification.id = attempt."verificationAuditId" AND verification."projectId" = ${projectId}
            AND verification."parentId" = attempt."sourceAuditId" AND verification.status = 'COMPLETED'
          WHERE attempt."improvementId" = incident.id
            AND (attempt."sourceObservations" IS NOT NULL AND cardinality(attempt."sourceFlagIds") > 0
              AND requested."flagId" = ANY(attempt."sourceFlagIds")
              OR (attempt."sourceObservations" IS NULL OR cardinality(attempt."sourceFlagIds") = 0)
                AND attempt."sourceAuditId" = requested."sourceAuditId"
                AND (attempt."handoffReference" IS NULL OR attempt."handoffReference" NOT LIKE 'flag:%'
                  OR attempt."handoffReference" = 'flag:' || requested."flagId"))
            AND attempt.outcome = 'IMPROVED' AND attempt.comparable = true
            AND jsonb_build_array(requested."flagId", verification.id) <> ALL(${skipped}::jsonb[])
            AND (${options.before ?? null}::timestamp IS NULL OR verification."completedAt" <= ${options.before ?? null})
            AND (requested."proofId" IS NULL OR verification.id = requested."proofId")
          ORDER BY verification."completedAt" DESC NULLS LAST, verification."createdAt" DESC, verification.id DESC,
            attempt."createdAt" DESC, attempt.id DESC LIMIT 1
        ) recovery ON true
        WHERE occurrence."improvementId" = incident.id AND occurrence."auditId" = captured."auditId"
          OR occurrence.id IS NULL AND captured.fingerprint = incident.fingerprint AND EXISTS (
            SELECT 1 FROM improvement_occurrences peer JOIN audits peer_source ON peer_source.id = peer."auditId"
            JOIN flags peer_flag ON peer_flag.id = peer."flagId" AND peer_flag."auditId" = peer_source.id
            WHERE peer."improvementId" = incident.id AND peer_source."projectId" = ${projectId})`
      const byId = new Map(batch.map(target => [target.id, target]))
      const nativeRows = rows.filter(row => row.capturedSource)
      const flags = nativeRows.length ? await db.flag.findMany({ where: { id: { in: nativeRows.map(row => row.flagId) },
        audit: { projectId }, status: 'OPEN' }, select: incidentRecoveryFlagSelect }) : []
      const byFlag = new Map(flags.map(flag => [flag.id, flag]))
      const nativeFlags = nativeRows.flatMap(row => {
        const flag = byFlag.get(row.flagId)
        return flag?.auditId === byId.get(row.flagId)?.auditId ? [{ ...flag, status: 'FIXED', resolvedInId: row.verificationAuditId }] : []
      })
      const nativeProofs = (await loadIncidentRecoveryProofs([{ projectId, flags: nativeFlags }], db)).get(projectId)
      const retry = new Set<string>()
      for (const row of rows) {
        const target = byId.get(row.flagId)
        if (!target || !attemptProvesFlagRecovery({ ...row,
          verificationAudit: { id: row.verificationAuditId, projectId: row.projectId, parentId: row.parentId, status: row.status } },
        projectId, target.auditId, target.id)) continue
        if (row.capturedSource && !nativeProofs?.hasFlag({ id: target.id, resolvedInId: row.verificationAuditId })) {
          // An improved frozen subset does not clear observations added later.
          // Search older certificates using scalar references, never copied drafts.
          skipped.push(JSON.stringify([target.id, row.verificationAuditId]))
          if (!target.proofId) retry.add(target.id)
          continue
        }
        proven.set(target.id, { auditId: row.verificationAuditId, completedAt: row.completedAt })
      }
      batch = batch.filter(target => retry.has(target.id) && !proven.has(target.id))
    }
  }
  return proven
}
