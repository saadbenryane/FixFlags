import { describe, expect, it } from 'vitest'
import { CHECKOUT_ENTRY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
import { calculateOutcomeRecoveryValue, type OutcomeFailure, type OutcomeObservation } from '../outcome-recovery-value'

const at = (day: number) => new Date(Date.UTC(2026, 10, 1 + day))
const destination = 'a'.repeat(64)
const control = 'b'.repeat(64)
const coverage = (result: 'SUCCEEDED' | 'FAILED', overrides = {}) => ({
  environment: 'production', requiredBindings: ['buy'], observedBindings: ['buy'],
  bindings: [{ key: 'buy', version: 1, mechanism: 'BROWSER_JOURNEY', config: {}, result,
    evaluator: CHECKOUT_ENTRY_EVALUATOR, checkoutDestinationKey: destination, purchaseControlKey: control, ...overrides }],
})
const incident = {
  version: 1, incidentRunRequestId: 'original-run', rootFlagIds: ['flag'], flagIds: [],
  recoveredFlagIds: [], previousAssessmentId: null,
}
const failure: OutcomeFailure = {
  flagId: 'flag', fingerprint: 'outcome:v1:checkout:buy', resolvedInId: 'recovery',
  auditId: 'original', outcomeId: 'checkout', projectId: 'project', kind: 'CHECKOUT', state: 'FLAG',
  requestedAt: at(0), completedAt: at(1), source: 'WATCH', coverage: coverage('FAILED'),
  evidence: { incident: { ...incident, transition: 'failure', flagIds: ['flag'] } },
}
const recovery: OutcomeObservation = {
  auditId: 'recovery', outcomeId: 'checkout', projectId: 'project', kind: 'CHECKOUT', state: 'CLEAR',
  requestedAt: at(2), completedAt: at(3), source: 'WEB', coverage: coverage('SUCCEEDED'),
  evidence: { incident: { ...incident, transition: 'recovery', recoveredFlagIds: ['flag'] } },
}
const followup: OutcomeObservation = {
  ...recovery, auditId: 'followup', requestedAt: at(4), completedAt: at(5), source: 'WATCH',
  evidence: { incident: { ...incident, transition: 'clear' } },
}
const report = (observations: OutcomeObservation[], failures = [failure]) =>
  calculateOutcomeRecoveryValue({ observations, failures, since: at(2), now: at(12) })

describe('retained Outcome recovery comparison', () => {
  it('requires the original checkout path and the recovery evaluator on follow-up', () => {
    const otherDestination = { ...followup, coverage: coverage('SUCCEEDED', { checkoutDestinationKey: 'c'.repeat(64) }) }
    const staleFailure = { ...followup, state: 'FLAG', coverage: coverage('FAILED', { evaluator: 'checkout-entry-v1' }) }
    expect(report([recovery, otherDestination, staleFailure]).counts).toMatchObject({
      matureRecoveredFlags: 1, scheduledAssessmentWithoutComparableResult: 1, firstComparablePass: 0, firstComparableFailure: 0,
    })
    expect(report([recovery, followup]).counts.firstComparablePass).toBe(1)
  })

  it('withholds recovery without retained checkout scope or the same incident', () => {
    const unknownScope = { ...failure, coverage: coverage('FAILED', { checkoutDestinationKey: null, purchaseControlKey: undefined }) }
    const otherIncident = { ...failure, evidence: { incident: { ...incident, transition: 'failure', incidentRunRequestId: 'other-run' } } }
    for (const source of [unknownScope, otherIncident]) {
      expect(report([recovery, followup], [source])).toMatchObject({
        counts: { matureRecoveredFlags: 0 }, coverage: { unprovenRecovery: 1 },
      })
    }
  })

  it('keeps a sibling recovery separate and excludes out-of-window scheduled checks', () => {
    const differentBinding = { ...recovery, state: 'FLAG',
      evidence: { incident: { ...incident, transition: 'ongoing_failure', recoveredFlagIds: ['flag'], recoveredBindingKeys: ['other'] } } }
    expect(report([differentBinding, followup]).coverage.unprovenRecovery).toBe(1)
    const tooLate = { ...followup, completedAt: at(11) }
    const alreadyInFlight = { ...followup, requestedAt: recovery.completedAt }
    expect(report([recovery, tooLate, alreadyInFlight]).counts).toMatchObject({
      matureRecoveredFlags: 1, noRetainedScheduledAssessment: 1,
    })
  })

  it('counts a failure after a scheduled pass only for a later, comparable request', () => {
    const overlapping = { ...followup, auditId: 'overlap', completedAt: at(6),
      state: 'FLAG', coverage: coverage('FAILED') }
    const recurrence = { ...overlapping, auditId: 'recurrence', requestedAt: at(7), completedAt: at(8) }
    const differentPath = { ...recurrence, coverage: coverage('FAILED', { checkoutDestinationKey: 'c'.repeat(64) }) }
    expect(report([recovery, followup, differentPath]).counts).toMatchObject({
      firstComparablePass: 1, anyComparableFailure: 0, comparableFailureAfterScheduledPass: 0,
    })
    expect(report([recovery, overlapping, followup]).counts).toMatchObject({
      firstComparablePass: 1, anyComparableFailure: 1, comparableFailureAfterScheduledPass: 0,
    })
    expect(report([recurrence, recovery, overlapping, followup]).counts).toMatchObject({
      firstComparablePass: 1, firstComparableFailure: 0, anyComparableFailure: 1, comparableFailureAfterScheduledPass: 1,
    })
  })
})
