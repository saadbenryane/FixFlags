import { describe, expect, it } from 'vitest'
import { assessmentIsComparable } from '../domain/assessment-comparability'
const binding = { key: 'http', required: true, version: 2, mechanism: 'HTTP_AVAILABILITY' }
const coverage = { environment: 'production', requiredBindings: ['http'], bindings: [{ key: 'http', version: 2, mechanism: 'HTTP_AVAILABILITY' }] }
describe('current assessment comparability', () => {
  it('matches only the exact required binding revisions and environment', () => {
    expect(assessmentIsComparable(coverage, [binding], 'production')).toBe(true)
    expect(assessmentIsComparable(coverage, [{ ...binding, version: 3 }], 'production')).toBe(false)
    expect(assessmentIsComparable(coverage, [binding], 'staging')).toBe(false)
    expect(assessmentIsComparable(coverage, [binding, { ...binding, key: 'new-binding' }], 'production')).toBe(false)
    expect(assessmentIsComparable(coverage, [], 'production')).toBe(false)
  })
  it('never upgrades unversioned historical coverage to current success', () => {
    expect(assessmentIsComparable({ environment: 'production', requiredBindings: ['http'] }, [{ ...binding, version: 1 }], 'production')).toBe(false)
  })
  it('requires the exact authorized fixture version for protected actions', () => {
    const current = { ...binding, mechanism: 'SAFE_FORM', fixture: { id: 'fixture', version: 4, authorized: true } }
    const receipt = { ...coverage, bindings: [{ ...current, fixture: { id: 'fixture', version: 4 } }] }
    expect(assessmentIsComparable(receipt, [current], 'production')).toBe(true)
    expect(assessmentIsComparable(receipt, [{ ...current, fixture: { id: 'fixture', version: 5, authorized: true } }], 'production')).toBe(false)
    expect(assessmentIsComparable(receipt, [{ ...current, fixture: { ...current.fixture, authorized: false } }], 'production')).toBe(false)
  })
})
