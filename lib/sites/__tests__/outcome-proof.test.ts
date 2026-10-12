import { describe, expect, it } from 'vitest'
import { comparableOutcomeCoverage, completeOutcomeEvidence } from '../domain/outcome-proof'

const scope = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
  bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: 'https://example.com/', expectedSelector: 'body' }, scope: null }], scope: null }
describe('Outcome scope proof', () => {
  it('compares the actual responsibility independently of JSON property order', () => {
    expect(comparableOutcomeCoverage(scope, { ...scope, bindings: [{ ...scope.bindings[0], config: { expectedSelector: 'body', startUrl: 'https://example.com/' } }] })).toBe(true)
    expect(completeOutcomeEvidence(scope, { reason: 'available' })).toBe(true)
  })
  it('rejects changed, duplicated or unrecorded responsibility', () => {
    for (const changed of [
      { ...scope, environment: 'staging' }, { ...scope, requiredBindings: ['http', 'http'] },
      { ...scope, bindings: [{ ...scope.bindings[0], version: 2 }] },
      { ...scope, bindings: [{ ...scope.bindings[0], config: { startUrl: 'https://other.test/' } }] },
      { ...scope, bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY' }] },
      { ...scope, policy: 'ANY_REQUIRED' }, { ...scope, scope: { device: 'mobile' } },
    ]) expect(comparableOutcomeCoverage(scope, changed)).toBe(false)
    expect(completeOutcomeEvidence({ ...scope, observedBindings: [] }, { reason: 'available' })).toBe(false)
    expect(completeOutcomeEvidence(scope, {})).toBe(false)
  })
})
