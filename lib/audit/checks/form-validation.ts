import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { FORM_VERIFICATION_RULE, type FormEvidence } from '../flow/form-evidence'

// Exact historical wire value. This describes a constraint observation, not
// interactive browser feedback. Keep decoding independent of later wording.
export const NATIVE_CONSTRAINT_OBSERVATION = 'Native constraints rejected empty required fields without a submission.'
export function currentFormFeedbackObservation(assertion: Pick<CheckAssertion, 'key' | 'observed' | 'passed'>): boolean {
  return !['empty-form-validation', 'form-feedback'].includes(assertion.key) ||
    !(assertion.passed && assertion.observed === NATIVE_CONSTRAINT_OBSERVATION)
}

/** Findings and repair assertions consume the same scoped browser observation. */
export function checkFormValidation(evidence: FormEvidence | undefined) {
  const flags: DeterministicFlag[] = [], assertions: CheckAssertion[] = []
  if (!evidence) return { flags, assertions, applicable: false, complete: true }
  const validationComplete = evidence.disposition !== 'unknown', passed = evidence.disposition === 'passed'
  const observed = evidence.reason === 'native_validation' ? NATIVE_CONSTRAINT_OBSERVATION
    : evidence.reason === 'native_feedback' ? `The trusted empty-field action invoked uncanceled native validation on a visible focused field after ${evidence.feedbackMs}ms. No submission was transmitted.`
    : evidence.reason === 'client_feedback' ? `New visible validation feedback appeared after ${evidence.feedbackMs}ms. No submission was transmitted.`
    : evidence.reason === 'missing_submit' ? 'The visible required-field form has no visible submit control.'
    : evidence.reason === 'missing_feedback' ? 'No new visible validation feedback appeared within 2000ms of the empty-field action.'
    : `Validation remains unknown (${evidence.reason.replaceAll('_', ' ')}).`
  assertions.push({ key: 'empty-form-validation', name: 'Empty-field form validation',
    expected: 'The same form rejects empty required fields with native validation or new visible feedback',
    observed, passed, complete: validationComplete, context: evidence.context })
  const timed = passed && ['native_feedback', 'client_feedback'].includes(evidence.reason) && evidence.feedbackMs !== null
  assertions.push({ key: 'form-feedback', name: 'Form validation feedback time',
    expected: 'The same form provides validation feedback within 1000ms', observed,
    passed: timed && evidence.feedbackMs! <= 1000, complete: timed || evidence.disposition === 'failed' && evidence.reason === 'missing_feedback', context: evidence.context })
  const base = { rubric: 'EXPERIENCE' as const, impactTag: 'CONVERSION' as const, confidence: 0.95,
    source: 'DETERMINISTIC' as const, pageUrl: evidence.pageUrl, verificationRule: FORM_VERIFICATION_RULE,
    evidenceTargets: [{ kind: 'element' as const, source: 'measured' as const, device: 'desktop' as const,
      selector: evidence.selector, label: evidence.label, context: evidence.context }] }
  if (evidence.disposition === 'failed') flags.push({ ...base, checkId: 'flow-form-no-validation', severity: 'IMPORTANT',
    problem: evidence.reason === 'missing_submit' ? 'Conversion form has no visible submit control' : 'Empty form submit shows no validation feedback',
    evidence: `${evidence.label}: ${observed}`,
    fix: 'Add a working submit control and required-field validation. Show accessible errors for empty fields, then verify the same form again.' })
  if (timed && evidence.feedbackMs! > 1000) flags.push({ ...base, checkId: 'flow-form-slow-feedback', severity: 'POLISH',
    problem: 'Form validation feedback is too slow', evidence: `${evidence.label}: ${observed}`,
    fix: 'Show validation feedback within one second of the empty-field action. Use native constraints or immediate accessible errors, then verify the same form again.' })
  return { flags, assertions, applicable: true, complete: assertions.every(assertion => assertion.complete === true) }
}
