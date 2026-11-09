import type { Prisma } from '@prisma/client'
import { checkoutScopeGaps, comparableOutcomeCoverage, recordedCheckoutFailureScope, recordedOutcomeBindingResults } from '../domain/outcome-proof'
import { readOutcomeIncident, readOutcomeRecovery } from '../domain/outcome-incident'
import { historicalCheckoutCaptureJoin, withHistoricalCheckoutDestination, type HistoricalCheckoutCapture } from './checkout-capture'
import { confirmedOutcomeFlagSql, outcomeReceiptJoins, supersededOutcomeReceiptSql } from './outcome-receipt-sql'

type FailureScope = NonNullable<ReturnType<typeof recordedCheckoutFailureScope>>
type ScopedFailure = { fingerprint: string; bindingKey: string; scope: FailureScope }
type FailureClassification = 'new' | 'ongoing' | 'regressed'

function sameFailureScope(coverage: unknown, failure: ScopedFailure) {
  const prior = recordedCheckoutFailureScope(coverage, failure.bindingKey)
  return Boolean(prior && prior.checkoutDestinationKey === failure.scope.checkoutDestinationKey &&
    (!prior.purchaseControlKey || prior.purchaseControlKey === failure.scope.purchaseControlKey))
}

/** A binding can retain several purchase paths. Use the matching path's
 * committed failure and recovery history to classify the new observation. */
export async function checkoutFailureHistory(tx: Pick<Prisma.TransactionClient, '$queryRaw' | 'flag'>, input: {
  projectId: string; outcomeId: string; requestedAt: Date; assessedAt: Date; coverage: unknown;
  failures: ScopedFailure[];
  previous: { auditId: string; coverage: unknown; evidence: unknown } | null;
}) {
  const classification = new Map<string, FailureClassification>()
  if (!input.failures.length) return classification
  const failures = new Map(input.failures.map(failure => [failure.fingerprint, failure]))
  const previous = input.previous
  const previousFlags = readOutcomeIncident(previous?.evidence)?.flagIds
  if (previous && previousFlags?.length) {
    const matching = input.failures.filter(failure => sameFailureScope(previous.coverage, failure))
    if (matching.length) {
      // Most Watch repeats match the last failed capture. Check its live
      // status first so a long-running incident need not re-read its history.
      const open = await tx.flag.findMany({ where: { id: { in: previousFlags }, auditId: previous.auditId,
        audit: { projectId: input.projectId }, status: { in: ['OPEN', 'REGRESSED'] },
        fingerprint: { in: matching.map(failure => failure.fingerprint) } }, select: { fingerprint: true } })
      for (const flag of open) if (flag.fingerprint) {
        classification.set(flag.fingerprint, 'ongoing')
        failures.delete(flag.fingerprint)
      }
    }
  }
  if (!failures.size) return classification
  const captures = await tx.$queryRaw<Array<{ id: string; fingerprint: string; status: string; resolvedInId: string | null;
    coverage: Prisma.JsonValue | null; evidence: unknown; capture: HistoricalCheckoutCapture | null }>>`
    SELECT f.id, f.fingerprint, f.status, f."resolvedInId", source.coverage, source.evidence, legacy_checkout.capture
    FROM outcome_assessments source ${outcomeReceiptJoins}
    JOIN flags f ON f."auditId" = source."auditId" AND f.fingerprint = ANY(${[...failures.keys()]}::text[])
      AND f.status IN ('OPEN', 'REGRESSED', 'FIXED', 'IGNORED')
    ${historicalCheckoutCaptureJoin}
    WHERE request."projectId" = ${input.projectId} AND source."outcomeId" = ${input.outcomeId}
      AND request."requestedAt" < ${input.requestedAt} AND source."assessedAt" <= ${input.assessedAt}
      AND ${confirmedOutcomeFlagSql}
  `
  const seen = new Set<string>()
  const resolved = captures.flatMap(flag => {
    const failure = failures.get(flag.fingerprint)!
    const coverage = withHistoricalCheckoutDestination(flag.coverage, flag.capture)
    if (!sameFailureScope(coverage, failure) || !comparableOutcomeCoverage(coverage, input.coverage)) return []
    seen.add(flag.fingerprint)
    if (flag.status === 'OPEN' || flag.status === 'REGRESSED') classification.set(flag.fingerprint, 'ongoing')
    return flag.status === 'FIXED' && flag.resolvedInId ? [{ flag, failure, coverage, auditId: flag.resolvedInId }] : []
  }).filter(({ flag }) => !classification.has(flag.fingerprint))
  if (resolved.length) {
    const recoveries = await tx.$queryRaw<Array<{ auditId: string; state: string; coverage: unknown; evidence: unknown }>>`
      SELECT source."auditId", source.state, source.coverage, source.evidence
      FROM outcome_assessments source ${outcomeReceiptJoins}
      WHERE request."projectId" = ${input.projectId} AND source."outcomeId" = ${input.outcomeId}
        AND request."requestedAt" < ${input.requestedAt} AND source."assessedAt" <= ${input.assessedAt}
        AND source."auditId" = ANY(${[...new Set(resolved.map(item => item.auditId))]}::text[])
        AND NOT (${supersededOutcomeReceiptSql})
    `
    const byAudit = Map.groupBy(recoveries, recovery => recovery.auditId)
    for (const { flag, failure, coverage, auditId } of resolved) {
      const proven = byAudit.get(auditId)?.some(row => {
        const recovery = readOutcomeRecovery(row.evidence, row.state)
        return recovery && (!recovery.recoveredBindingKeys || recovery.recoveredBindingKeys.includes(failure.bindingKey)) &&
          (recovery.recoveredFlagIds.includes(flag.id) || recovery.incidentRunRequestId === readOutcomeIncident(flag.evidence)?.incidentRunRequestId) &&
          comparableOutcomeCoverage(coverage, row.coverage) &&
          recordedOutcomeBindingResults(row.coverage, 'CHECKOUT').get(failure.bindingKey) === 'SUCCEEDED' &&
          !checkoutScopeGaps(input.coverage, row.coverage).has(failure.bindingKey)
      })
      if (proven) classification.set(flag.fingerprint, 'regressed')
    }
  }
  for (const fingerprint of failures.keys()) {
    if (!classification.has(fingerprint)) classification.set(fingerprint, seen.has(fingerprint) ? 'ongoing' : 'new')
  }
  return classification
}
