import { expect, it } from 'vitest'
import { checkFormValidation, NATIVE_CONSTRAINT_OBSERVATION } from './form-validation'
import { scopedAssertionForTarget } from './verification'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { FORM_VERIFICATION_RULE, type FormEvidence } from '../flow/form-evidence'

const pageUrl = 'https://example.com/signup', context = 'form:' + 'a'.repeat(64)
const evidence: FormEvidence = { version: 1, pageUrl, context, selector: 'form#signup', label: 'Sign up',
  disposition: 'passed', reason: 'client_feedback', feedbackMs: 200 }
const execution = { auditId: 'after', taskId: 'form-task', checkVersion: 1, source: 'rendered-dom' as const, collectedAt: new Date().toISOString() }
const receipt = { kind: 'site-module-check' as const, version: 1 as const, module: 'form-validation', pageUrl,
  applicable: true, complete: true, passed: true, execution, assertions: checkFormValidation(evidence).assertions }
const flag = { checkId: 'flow-form-no-validation', pageUrl, verificationRule: FORM_VERIFICATION_RULE,
  evidenceTargets: [{ selector: evidence.selector, label: evidence.label, context }] }

it('shares exact form scope proof between verification and automatic recovery', () => {
  expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
  const input = { auditId: 'after', executionSpec: { version: 1, engine: 'progressive-v1', targetUrl: pageUrl,
    environment: 'production', scope: 'SITE', checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null }, flag,
    executions: [{ targetKey: 'module:form-validation', status: 'COMPLETED', detail: receipt }] }
  expect(hasRecordedRecoveryEvidence(input)).toBe(true)
  for (const modified of [
    { ...flag, evidenceTargets: [] }, { ...flag, verificationRule: null },
    { ...flag, evidenceTargets: [{ ...flag.evidenceTargets[0], context: 'form:' + 'b'.repeat(64) }] },
    { ...flag, evidenceTargets: [...flag.evidenceTargets, { ...flag.evidenceTargets[0], context: 'unobserved-form' }] },
  ]) {
    expect(scopedAssertionForTarget({ receipt, checkId: flag.checkId, flag: modified })).toBeUndefined()
    expect(hasRecordedRecoveryEvidence({ ...input, flag: modified })).toBe(false)
  }
})

it('does not turn unknown form evidence or the absence of a Flag into repair', () => {
  for (const reason of ['submission_blocked', 'prefilled_fields', 'form_unavailable', 'execution_interrupted', 'preexisting_feedback'] as const) {
    const checked = checkFormValidation({ ...evidence, disposition: 'unknown', reason, feedbackMs: null })
    expect(checked.flags).toEqual([])
    expect(checked.complete).toBe(false)
    expect(scopedAssertionForTarget({ receipt: { ...receipt, complete: false, passed: false, assertions: checked.assertions },
      checkId: flag.checkId, flag })).toBeUndefined()
  }
})

it('can verify rejection of empty fields while retaining an independently observed feedback delay', () => {
  const checked = checkFormValidation({ ...evidence, feedbackMs: 1400 })
  expect(checked.flags.map(flag => flag.checkId)).toEqual(['flow-form-slow-feedback'])
  const slow = { ...receipt, passed: false, assertions: checked.assertions }
  expect(scopedAssertionForTarget({ receipt: slow, checkId: 'flow-form-no-validation', flag })?.assertion.passed).toBe(true)
  expect(scopedAssertionForTarget({ receipt: slow, checkId: 'flow-form-slow-feedback', flag })?.assertion.passed).toBe(false)
})

it('retains a native constraint fact without claiming historical zero-time feedback or a repair', () => {
  const checked = checkFormValidation({ ...evidence, reason: 'native_validation', feedbackMs: 0 })
  expect(checked.complete).toBe(false)
  expect(checked.assertions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'empty-form-validation', passed: true, complete: true }),
    expect.objectContaining({ key: 'form-feedback', passed: false, complete: false }),
  ]))
  const old = { ...receipt, assertions: receipt.assertions.map(assertion => ({ ...assertion, observed: NATIVE_CONSTRAINT_OBSERVATION })) }
  expect(scopedAssertionForTarget({ receipt: old, checkId: flag.checkId, flag })).toBeUndefined()
  expect(scopedAssertionForTarget({ receipt: old, checkId: 'flow-form-slow-feedback', flag })).toBeUndefined()
})

it('keeps conclusive missing feedback separate from unavailable timing', () => {
  const checked = checkFormValidation({ ...evidence, disposition: 'failed', reason: 'missing_feedback', feedbackMs: null })
  expect(checked.complete).toBe(true)
  expect(checked.assertions).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'form-feedback', passed: false, complete: true }),
  ]))
})

it('accepts freshly observed native reporting under the same original form scope', () => {
  const checked = checkFormValidation({ ...evidence, reason: 'native_feedback', feedbackMs: 20 })
  expect(checked.complete).toBe(true)
  const measured = { ...receipt, assertions: checked.assertions }
  expect(scopedAssertionForTarget({ receipt: measured, checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
  expect(scopedAssertionForTarget({ receipt: measured, checkId: 'flow-form-slow-feedback', flag })?.assertion.passed).toBe(true)
})
