import { expect, it } from 'vitest'
import { assessTargetedOutcomeCoverage } from './verification-coverage'
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
