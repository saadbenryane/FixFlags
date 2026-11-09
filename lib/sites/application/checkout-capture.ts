import { createHash } from 'node:crypto'
import { Prisma } from '@prisma/client'
import { isCheckoutUrl } from '@/lib/integrity/buy-controls'
import { recordedCheckoutScope } from '../domain/outcome-proof'

export function checkoutDestinationKey(destinationUrl: string | null | undefined, mainUrl: string): string | null {
  const destination = destinationUrl || (isCheckoutUrl(mainUrl) ? mainUrl : null)
  return destination ? createHash('sha256').update(destination).digest('hex') : null
}

export type HistoricalCheckoutCapture = {
  bindingKey: string
  bindingVersion: number
  destinationUrl: string | null
  url: string
}

/** Source and Flag aliases are already tenant-scoped by the caller. Only an
 * execution that names this exact Flag can supply its historical walk. */
export const historicalCheckoutCaptureJoin = Prisma.sql`
  LEFT JOIN LATERAL (
    SELECT jsonb_agg(jsonb_build_object('bindingKey', execution."bindingKey", 'bindingVersion', execution."bindingVersion",
      'destinationUrl', terminal."actionDetail"->>'destinationUrl', 'url', terminal.url))->0 AS capture
    FROM outcome_binding_executions execution
    JOIN journey_reviews review ON review."auditId" = source."auditId" AND review."journeyType" = 'checkout'
      AND review.id = COALESCE(execution.detail->>'journeyReviewId', source.evidence->>'journeyReviewId')
    CROSS JOIN LATERAL (
      SELECT step.url, step."actionDetail", step."actionType"
      FROM journey_steps step WHERE step."journeyReviewId" = review.id
      ORDER BY step."stepNumber" DESC LIMIT 1
    ) terminal
    WHERE execution."auditId" = source."auditId" AND execution."outcomeId" = source."outcomeId"
      AND execution.mechanism = 'BROWSER_JOURNEY' AND execution.disposition = 'FAILED'
      AND execution.detail->>'failureFlagId' = f.id
      AND terminal."actionType" = 'failure' AND terminal."actionDetail"->>'bindingKey' = execution."bindingKey"
      AND NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(source.coverage->'bindings') = 'array'
          THEN source.coverage->'bindings' ELSE '[]'::jsonb END) binding
        WHERE binding->>'key' = execution."bindingKey" AND binding ? 'checkoutDestinationKey'
      )
    HAVING count(*) = 1
  ) legacy_checkout ON TRUE
`

/** Reconstitute only the observed scope. The archived assessment stays intact. */
export function withHistoricalCheckoutDestination(coverage: Prisma.JsonValue | null, capture: HistoricalCheckoutCapture | null): Prisma.JsonValue | null {
  if (!capture || !coverage || typeof coverage !== 'object' || Array.isArray(coverage) || !Array.isArray(coverage.bindings)) return coverage
  const key = checkoutDestinationKey(capture.destinationUrl, capture.url)
  if (!key) return coverage
  return { ...coverage, bindings: coverage.bindings.map(binding =>
    binding && typeof binding === 'object' && !Array.isArray(binding) && binding.key === capture.bindingKey &&
    binding.version === capture.bindingVersion && recordedCheckoutScope(binding).checkoutDestinationKey === undefined
      ? { ...binding, checkoutDestinationKey: key } : binding) }
}
