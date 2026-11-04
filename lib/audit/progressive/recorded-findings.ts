import { Prisma } from '@prisma/client'
import { OBSERVATION_TARGETS } from './observation-progress'

/** Completed task results and committed continuation checkpoints are the
 * original finding artifacts, independently of the parent analysis status. */
export function recordedFindingArtifactsSql(auditId: string | Prisma.Sql) {
  return Prisma.sql`
    SELECT "workResult"->'data'->'flags' AS findings, "id" AS "taskId",
      COALESCE("workResult"->'data'->'receipt'->'execution'->>'collectedAt', "workResult"->>'collectedAt') AS "collectedAt", "createdAt", "id"
      FROM "audit_execution_tasks"
      WHERE "auditId" = ${auditId} AND "workState" = 'COMPLETED'
        AND "workKind" IN ('check', 'search', 'google', 'flow', 'overlays', 'journeys', 'slow-replay', 'cross-page', 'discovery', 'automatic-accounts')
        AND "workResult"->'data'->'flags' <> '[]'::jsonb
        AND ("workInput"->'verificationContexts') IS NULL
        AND ("workResult"->'data'->'observationProgress') IS NULL
    UNION ALL
    SELECT detail->'data'->'flags' AS findings, "taskId",
      COALESCE(detail->'data'->'receipt'->'execution'->>'collectedAt', detail->>'collectedAt') AS "collectedAt", "createdAt", "id"
      FROM "audit_verifier_executions" WHERE "auditId" = ${auditId} AND "targetKey" IN (${Prisma.join(OBSERVATION_TARGETS)})
        AND status = 'COMPLETED' AND detail->'data'->'flags' <> '[]'::jsonb`
}
