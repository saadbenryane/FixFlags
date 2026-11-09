import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import type { SiteRecord } from '../types'
import { outcomeReceiptJoins } from './outcome-receipt-sql'

export type OutcomeReferences = {
  id: string; assessmentIds: string[]; successfulAssessmentId: string | null; runRequestIds: string[];
  bindingAttemptIds: string[]; executionIds: string[]; improvementIds: string[]; occurrenceIds: string[]; improvementAttemptIds: string[];
}

/** Correlated limits run in PostgreSQL. Prisma's multi-parent relation take
 * trims in memory and would otherwise fetch the full history of each Outcome. */
export function loadOutcomeDetailReferences(site: SiteRecord, options: { outcomeId?: string; excludeGeneric?: boolean }) {
  return loadOutcomeReferences(site, options, true)
}

export function loadOutcomeSummaryReferences(site: SiteRecord) {
  return loadOutcomeReferences(site, {}, false)
}

export function loadOutcomeSummaryReferencesForProjects(projectIds: string[]) {
  return loadOutcomeReferences({ projectIds }, { enabledOnly: true }, false)
}

function loadOutcomeReferences(scope: SiteRecord | { projectIds: string[] },
  options: { outcomeId?: string; excludeGeneric?: boolean; enabledOnly?: boolean }, detail: boolean) {
  if ('projectIds' in scope && scope.projectIds.length === 0) return Promise.resolve([])
  const owner = 'projectIds' in scope ? Prisma.sql`o."projectId" IN (${Prisma.join(scope.projectIds)})`
    : scope.kind === 'project' ? Prisma.sql`o."projectId" = ${scope.projectId}`
      : Prisma.sql`o."provisionalSiteId" = ${scope.provisionalSiteId}`
  const history = (selection: Prisma.Sql) => detail ? selection : Prisma.sql`ARRAY[]::text[]`
  const receipts = Prisma.sql`FROM outcome_assessments source ${outcomeReceiptJoins}
    WHERE source."outcomeId" = o.id AND request."projectId" = o."projectId"`
  return prisma.$queryRaw<OutcomeReferences[]>(Prisma.sql`
    SELECT o.id,
      ARRAY(SELECT source.id ${receipts} ORDER BY request."requestedAt" DESC, source."assessedAt" DESC LIMIT ${detail ? 20 : 1}) AS "assessmentIds",
      ${detail ? Prisma.sql`(SELECT source.id ${receipts} AND source.state = 'CLEAR'
        AND source.evidence ->> 'supersededByAssessmentId' IS NULL
        ORDER BY source."assessedAt" DESC LIMIT 1)` : Prisma.sql`NULL::text`} AS "successfulAssessmentId",
      ARRAY(SELECT s."runRequestId" FROM run_request_outcomes s JOIN run_requests r ON r.id = s."runRequestId"
        WHERE s."outcomeId" = o.id AND r."projectId" = o."projectId"
          AND (r."auditId" IS NULL OR EXISTS (SELECT 1 FROM audits a WHERE a.id = r."auditId" AND a."projectId" = r."projectId"))
        ORDER BY r."requestedAt" DESC LIMIT ${detail ? 20 : 1}) AS "runRequestIds",
      ${history(Prisma.sql`ARRAY(SELECT b.id FROM outcome_binding_attempts b WHERE b."outcomeId" = o.id
        ORDER BY b."createdAt" DESC LIMIT 20)`)} AS "bindingAttemptIds",
      ${history(Prisma.sql`ARRAY(SELECT e.id FROM outcome_binding_executions e WHERE e."outcomeId" = o.id
        ORDER BY e."createdAt" DESC LIMIT 50)`)} AS "executionIds",
      ${history(Prisma.sql`ARRAY(SELECT i.id FROM improvements i WHERE i."outcomeId" = o.id AND i."projectId" = o."projectId")`)} AS "improvementIds",
      ${history(Prisma.sql`ARRAY(SELECT c.id FROM improvements i CROSS JOIN LATERAL
        (SELECT c.id FROM improvement_occurrences c WHERE c."improvementId" = i.id ORDER BY c."createdAt" DESC LIMIT 20) c
        WHERE i."outcomeId" = o.id AND i."projectId" = o."projectId")`)} AS "occurrenceIds",
      ${history(Prisma.sql`ARRAY(SELECT a.id FROM improvements i CROSS JOIN LATERAL
        (SELECT a.id FROM improvement_attempts a WHERE a."improvementId" = i.id ORDER BY a."createdAt" DESC LIMIT 20) a
        WHERE i."outcomeId" = o.id AND i."projectId" = o."projectId")`)} AS "improvementAttemptIds"
    FROM site_outcomes o WHERE ${owner}
      ${options.outcomeId ? Prisma.sql`AND o.id = ${options.outcomeId}` : Prisma.empty}
      ${options.excludeGeneric ? Prisma.sql`AND o.kind <> 'GENERIC'` : Prisma.empty}
      ${options.enabledOnly ? Prisma.sql`AND o.enabled` : Prisma.empty}
    ORDER BY o."createdAt" ASC
  `)
}
