import { outcomeFlagOwner } from '@/lib/audit/flag-identity'
import { readOutcomeIncident, readOutcomeRecovery } from '@/lib/sites/domain/outcome-incident'
import { recordedBindingEvaluator } from '@/lib/sites/domain/outcome-evaluation'
import {
  checkoutScopeGaps, comparableOutcomeCoverage, recordedCheckoutFailureScope, recordedOutcomeBindingResults,
} from '@/lib/sites/domain/outcome-proof'

const FOLLOWUP_DAYS = 7
const DAY_MS = 86_400_000

function bindingEvaluatorAt(coverage: unknown, key: string) {
  const bindings = (coverage as { bindings?: unknown } | null)?.bindings
  if (!Array.isArray(bindings)) return undefined
  return recordedBindingEvaluator(bindings.find((binding: unknown) =>
    binding && typeof binding === 'object' && 'key' in binding && binding.key === key))
}

export type OutcomeObservation = {
  auditId: string
  outcomeId: string
  projectId: string
  kind: string
  state: string
  source: string
  requestedAt: Date
  completedAt: Date
  coverage: unknown
  evidence: unknown
}

export type OutcomeFailure = OutcomeObservation & {
  flagId: string
  fingerprint: string | null
  resolvedInId: string
}

export type OutcomeRecoveryEvidence = { observations: OutcomeObservation[]; failures: OutcomeFailure[] }

/** Private reporting over committed native receipts. No Flag or assessment is changed. */
export function calculateOutcomeRecoveryValue(input: OutcomeRecoveryEvidence & { since: Date; now: Date }) {
  return summarizeOutcomeRecoveryEvidence(input).report
}

/** Recovery windows are for internal joins. Return only the report across output boundaries. */
export function summarizeOutcomeRecoveryEvidence(input: OutcomeRecoveryEvidence & { since: Date; now: Date }) {
  const failuresByFlag = Map.groupBy(input.failures, failure => failure.flagId)
  const watchByOutcome = Map.groupBy(input.observations.filter(row => row.source === 'WATCH'), row => row.outcomeId)
  for (const rows of watchByOutcome.values()) rows.sort((a, b) => a.completedAt.getTime() - b.completedAt.getTime())
  const resultsByObservation = new Map<OutcomeObservation, ReturnType<typeof recordedOutcomeBindingResults>>()
  function bindingResult(observation: OutcomeObservation, bindingKey: string) {
    if ((observation.coverage as { environment?: unknown } | null)?.environment !== 'production') return undefined
    let results = resultsByObservation.get(observation)
    if (!results) {
      results = recordedOutcomeBindingResults(observation.coverage, observation.kind)
      resultsByObservation.set(observation, results)
    }
    return results.get(bindingKey)
  }
  const coverage = { namedRecoveredFlags: 0, unprovenRecovery: 0, immatureRecoveries: 0 }
  const counts = {
    verifiedRecoveredFlags: 0,
    matureRecoveredFlags: 0,
    firstComparablePass: 0,
    firstComparableFailure: 0,
    anyComparableFailure: 0,
    comparableFailureAfterScheduledPass: 0,
    scheduledAssessmentWithoutComparableResult: 0,
    noRetainedScheduledAssessment: 0,
  }
  const seen = new Set<string>()
  const sites = new Set<string>()
  const matureRecoveryWindows = new Map<OutcomeObservation, Date>()
  for (const recovery of input.observations) {
    const receipt = readOutcomeRecovery(recovery.evidence, recovery.state)
    if (!receipt) continue
    for (const id of new Set(receipt.recoveredFlagIds)) {
      coverage.namedRecoveredFlags++
      const candidates = (failuresByFlag.get(id) ?? []).filter(failure =>
        failure.resolvedInId === recovery.auditId && failure.auditId !== recovery.auditId &&
        failure.projectId === recovery.projectId && failure.outcomeId === recovery.outcomeId &&
        failure.kind === recovery.kind && failure.completedAt <= recovery.requestedAt &&
        readOutcomeIncident(failure.evidence)?.incidentRunRequestId === receipt.incidentRunRequestId)
      const failure = candidates.length === 1 ? candidates[0] : undefined
      const owner = outcomeFlagOwner(failure?.fingerprint)
      if (!failure || !owner || owner.outcomeId !== recovery.outcomeId ||
        (receipt.recoveredBindingKeys && !receipt.recoveredBindingKeys.includes(owner.bindingKey)) ||
        bindingResult(failure, owner.bindingKey) !== 'FAILED' ||
        bindingResult(recovery, owner.bindingKey) !== 'SUCCEEDED' ||
        !comparableOutcomeCoverage(failure.coverage, recovery.coverage)) {
        coverage.unprovenRecovery++
        continue
      }
      const { bindingKey } = owner
      const evaluator = bindingEvaluatorAt(recovery.coverage, bindingKey)
      const checkout = recovery.kind === 'CHECKOUT'
      if (checkout && (!recordedCheckoutFailureScope(failure.coverage, bindingKey) ||
        checkoutScopeGaps(failure.coverage, recovery.coverage).has(bindingKey))) {
        coverage.unprovenRecovery++
        continue
      }
      if (seen.has(id)) continue
      seen.add(id)
      counts.verifiedRecoveredFlags++
      const end = new Date(recovery.completedAt.getTime() + FOLLOWUP_DAYS * DAY_MS)
      if (end > input.now) {
        coverage.immatureRecoveries++
        continue
      }
      sites.add(recovery.projectId)
      counts.matureRecoveredFlags++
      matureRecoveryWindows.set(recovery, end)
      const scheduled = (watchByOutcome.get(recovery.outcomeId) ?? []).filter(row =>
        row.projectId === recovery.projectId && row.kind === recovery.kind && row.auditId !== recovery.auditId &&
        row.requestedAt > recovery.completedAt && row.completedAt <= end)
      let firstResult: 'SUCCEEDED' | 'FAILED' | undefined
      let firstPassCompletedAt: Date | undefined
      let sawFailure = false
      let sawFailureAfterPass = false
      for (const row of scheduled) {
        const result = bindingResult(row, bindingKey)
        if (!result || bindingEvaluatorAt(row.coverage, bindingKey) !== evaluator ||
          !comparableOutcomeCoverage(failure.coverage, row.coverage) ||
          (checkout && checkoutScopeGaps(failure.coverage, row.coverage).has(bindingKey))) continue
        firstResult ??= result
        if (result === 'SUCCEEDED') firstPassCompletedAt ??= row.completedAt
        else {
          sawFailure = true
          sawFailureAfterPass ||= Boolean(firstPassCompletedAt && row.requestedAt > firstPassCompletedAt)
        }
      }
      if (sawFailure) counts.anyComparableFailure++
      if (sawFailureAfterPass) counts.comparableFailureAfterScheduledPass++
      if (firstResult === 'SUCCEEDED') {
        counts.firstComparablePass++
      } else if (firstResult === 'FAILED') {
        counts.firstComparableFailure++
      } else if (scheduled.length) {
        counts.scheduledAssessmentWithoutComparableResult++
      } else {
        counts.noRetainedScheduledAssessment++
      }
    }
  }
  const report = {
    version: 1,
    source: 'retained-outcome-assessments',
    unit: 'recovered Flag with a versioned Outcome binding',
    cohortStart: input.since.toISOString(),
    asOf: input.now.toISOString(),
    followupDays: FOLLOWUP_DAYS,
    counts: { ...counts, sitesWithMatureRecovery: sites.size },
    coverage: { retainedAssessments: input.observations.length, ...coverage },
    databaseWritten: false,
    limitations: [
      'Counts use matched native failure and recovery receipts, the retained Flag resolution reference, and the same current Site owner. They do not establish which change caused recovery.',
      'The first comparable retained scheduled observation is a point-in-time result. A passing observation does not prove uninterrupted recovery, and a failure does not establish its cause.',
      'Failure counts are per recovered Flag within the same seven-day window. Failure after a scheduled pass requires a comparable failing request started after a comparable scheduled pass finished.',
      'A missing scheduled assessment does not prove no monitoring was attempted. Incomplete evidence, changed bindings and checkout scope gaps cannot qualify a comparison.',
      'Only recoveries with a complete seven-day window enter follow-up counts. Missing, legacy, deleted or inconsistent source evidence may be withheld.',
      'Private operational aggregates do not establish permission for public research, a representative population or an AI builder comparison.',
    ],
  }
  return { report, matureRecoveryWindows }
}
