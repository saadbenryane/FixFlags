import { Prisma } from '@prisma/client'

/** A receipt must name its request's Audit and one of its selected Outcomes.
 * Callers scope the request and Outcome to the same Site. */
export const outcomeReceiptJoins = Prisma.sql`
  JOIN run_requests request ON request.id = source."runRequestId" AND request."auditId" = source."auditId"
  JOIN audits observed ON observed.id = source."auditId" AND observed."projectId" = request."projectId"
  JOIN run_request_outcomes selection ON selection."runRequestId" = request.id AND selection."outcomeId" = source."outcomeId"
    AND (jsonb_typeof(request."executionSpec"->'outcomes') IS DISTINCT FROM 'array'
      OR request."executionSpec"->'outcomes' @> jsonb_build_array(jsonb_build_object('id', source."outcomeId")))
`

export const supersededOutcomeReceiptSql = Prisma.sql`source.evidence ->> 'supersededByAssessmentId' IS NOT NULL`

/** An older receipt may use the binding execution's exact Flag reference. */
export const confirmedOutcomeFlagSql = Prisma.sql`
  source.state = 'FLAG' AND NOT (${supersededOutcomeReceiptSql})
  AND (source.evidence #> '{incident,flagIds}' @> jsonb_build_array(f.id) OR
    (source.evidence->'incident' IS NULL AND EXISTS (
      SELECT 1 FROM outcome_binding_executions execution WHERE execution."auditId" = source."auditId"
        AND execution."outcomeId" = source."outcomeId" AND execution.disposition = 'FAILED'
        AND execution.detail->>'failureFlagId' = f.id
    )))
`
