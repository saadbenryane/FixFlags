import { expect, it } from 'vitest'
import { assessTargetedOutcomeCoverage } from './verification-coverage'
import { CHECKOUT_ENTRY_EVALUATOR, DEFAULT_AVAILABILITY_EVALUATOR } from '@/lib/sites/domain/outcome-evaluation'
const coverage = { environment: 'production', requiredBindings: ['checkout'], observedBindings: ['checkout'], scope: { pageUrl: 'https://shop.test/product', device: 'mobile' }, bindings: [{ key: 'checkout', mechanism: 'BROWSER_JOURNEY', version: 1, config: { startUrl: 'https://shop.test/product', safety: 'stop-at-checkout' } }] }
const input = {
  auditId: 'after', auditStatus: 'COMPLETED', projectId: 'site', parentAuditId: 'before', outcomeId: 'checkout', attemptId: 'attempt',
  run: { id: 'run', projectId: 'site', status: 'COMPLETED', environment: 'production', verificationTarget: { kind: 'OUTCOME', outcomeId: 'checkout', attemptId: 'attempt', parentAuditId: 'before' }, assessments: [{ outcomeId: 'checkout', auditId: 'after', runRequestId: 'run', state: 'CLEAR', coverage, evidence: { reason: 'required_bindings_succeeded', screenshots: ['persisted-capture'] } }] },
  sourceAssessment: { state: 'FLAG', coverage },
}
it('uses fresh completed required Outcome evidence even when optional report evidence is partial', () => {
  expect(assessTargetedOutcomeCoverage(input).comparable).toBe(true)
})
it('also makes an independently reproduced failure comparable rather than calling it a coverage gap', () => {
  const failed = { ...input, run: { ...input.run, assessments: [{ ...input.run.assessments[0], state: 'FLAG' }] } }
  expect(assessTargetedOutcomeCoverage(failed).comparable).toBe(true)
})
it.each(['checkoutDestinationKey', 'purchaseControlKey'])('compares the selected Checkout Flag’s observed %s', scopeKey => {
  const binding = { ...coverage.bindings[0], evaluator: CHECKOUT_ENTRY_EVALUATOR }
  const source = { ...coverage, bindings: [{ ...binding, result: 'FAILED', [scopeKey]: 'a'.repeat(64) }] }
  const verify = (key: string) => assessTargetedOutcomeCoverage({
    ...input, bindingKey: binding.key, outcomeKind: 'CHECKOUT', sourceAssessment: { state: 'FLAG', coverage: source },
    run: { ...input.run, assessments: [{ ...input.run.assessments[0],
      coverage: { ...coverage, bindings: [{ ...binding, result: 'SUCCEEDED', [scopeKey]: key }] } }] },
  })
  expect(verify('b'.repeat(64))).toMatchObject({ comparable: false, verdict: null })
  expect(verify('a'.repeat(64))).toMatchObject({ comparable: true, verdict: 'passed' })
})
it('requires the current default availability evaluator for a repair pass', () => {
  const binding = { key: 'http', mechanism: 'HTTP_AVAILABILITY', version: 1,
    config: { startUrl: 'https://example.com/', expectedSelector: 'body' } }
  const source = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'], bindings: [binding] }
  const assessment = { ...input.run.assessments[0], coverage: source }
  const repair = { ...input, outcomeKind: 'AVAILABILITY', sourceAssessment: { state: 'FLAG', coverage: source },
    run: { ...input.run, assessments: [assessment] } }
  expect(assessTargetedOutcomeCoverage(repair).comparable).toBe(false)
  expect(assessTargetedOutcomeCoverage({ ...repair, run: { ...repair.run, assessments: [{ ...assessment, state: 'FLAG' }] } }).comparable).toBe(true)
  expect(assessTargetedOutcomeCoverage({ ...repair, run: { ...repair.run, assessments: [{ ...assessment,
    coverage: { ...source, bindings: [{ ...binding, evaluator: DEFAULT_AVAILABILITY_EVALUATOR }] } }] } }).comparable).toBe(true)
})
it('uses the same scope proof for an ordinary scheduled child without inventing a targeted request', () => {
  const automatic = { ...input, targeted: false, run: { ...input.run, verificationTarget: null } }
  expect(assessTargetedOutcomeCoverage(automatic).comparable).toBe(true)
  expect(assessTargetedOutcomeCoverage({ ...automatic, targeted: true }).comparable).toBe(false)
  expect(assessTargetedOutcomeCoverage({ ...automatic, run: { ...automatic.run, verificationTarget: { kind: 'DIAGNOSTIC' } } }).comparable).toBe(false)
})
it('requires positive proof of the original binding when a sibling fails', () => {
  const binding = { key: 'page', mechanism: 'HTTP_AVAILABILITY', version: 1, config: { startUrl: 'https://example.com/' } }
  const source = { environment: 'production', requiredBindings: ['page', 'peer'], observedBindings: ['page', 'peer'],
    bindings: [binding, { ...binding, key: 'peer', config: { startUrl: 'https://example.com/peer' } }] }
  const observed = { ...source, bindings: [{ ...binding, evaluator: DEFAULT_AVAILABILITY_EVALUATOR, result: 'SUCCEEDED' },
    { ...source.bindings[1], result: 'FAILED' }] }
  const assessment = { ...input.run.assessments[0], state: 'FLAG', coverage: observed }
  const repair = { ...input, outcomeKind: 'AVAILABILITY', bindingKey: 'page', recoveredByRun: true,
    sourceAssessment: { state: 'FLAG', coverage: source }, run: { ...input.run, assessments: [assessment] } }
  expect(assessTargetedOutcomeCoverage(repair)).toMatchObject({ comparable: true, verdict: 'passed' })
  expect(assessTargetedOutcomeCoverage({ ...repair, recoveredByRun: false })).toMatchObject({ comparable: false })
  expect(assessTargetedOutcomeCoverage({ ...repair, bindingKey: 'peer' })).toMatchObject({ comparable: true, verdict: 'failed' })
  expect(assessTargetedOutcomeCoverage({ ...repair, run: { ...repair.run, assessments: [{ ...assessment, coverage: source }] } }))
    .toMatchObject({ comparable: false })
  expect(assessTargetedOutcomeCoverage({ ...repair, run: { ...repair.run, assessments: [{ ...assessment,
    evidence: { supersededByAssessmentId: 'later' } }] } })).toMatchObject({ comparable: false })
})
it('refuses blocked or missing evidence, changed required scope and unrelated identities', () => {
  for (const assessment of [
    { ...input.run.assessments[0], state: 'COULD_NOT_VERIFY' },
    { ...input.run.assessments[0], evidence: {} },
    { ...input.run.assessments[0], coverage: { ...coverage, observedBindings: [] } },
    { ...input.run.assessments[0], coverage: { ...coverage, scope: { pageUrl: 'https://other.test', device: 'mobile' } } },
    { ...input.run.assessments[0], coverage: { ...coverage, bindings: [] } },
    { ...input.run.assessments[0], coverage: { ...coverage, bindings: [{ ...coverage.bindings[0], version: 2 }] } },
    { ...input.run.assessments[0], auditId: 'unrelated' },
    { ...input.run.assessments[0], runRequestId: 'unrelated' },
  ]) expect(assessTargetedOutcomeCoverage({ ...input, run: { ...input.run, assessments: [assessment] } }).comparable).toBe(false)
  expect(assessTargetedOutcomeCoverage({ ...input, projectId: 'other' }).comparable).toBe(false)
  expect(assessTargetedOutcomeCoverage({ ...input, attemptId: 'other' }).comparable).toBe(false)
  expect(assessTargetedOutcomeCoverage({ ...input, auditStatus: 'FAILED' }).comparable).toBe(false)
  expect(assessTargetedOutcomeCoverage({ ...input, sourceAssessment: null }).comparable).toBe(false)
})
