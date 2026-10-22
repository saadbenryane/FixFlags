import { describe, expect, it } from 'vitest'
import { assertPrescriptionScope, freezePrescriptionScope, guidanceHash, prescriptionHash } from '../prescription-scope'

const flag = { id: 'flag-1', checkId: 'title-missing', fingerprint: 'original', source: 'DETERMINISTIC',
  pageUrl: 'https://example.com/pricing', problem: 'Title missing', evidence: 'No title element',
  verificationRule: 'Inspect the same page', fix: 'Restore the title', supportingObservations: { version: 1, items: [{ pageUrl: '/pricing' }] } }

describe('frozen prescription scope', () => {
  it.each(['source', 'checkId', 'fingerprint', 'pageUrl', 'problem', 'evidence', 'verificationRule', 'fix', 'supportingObservations',
    'confidence', 'causeCertainty', 'fixConfidence', 'attentionPolicy', 'impactTag'])(
    'refuses changed %s without publishing stale guidance', field => {
      const scope = freezePrescriptionScope([flag])
      expect(() => assertPrescriptionScope(scope, [{ ...flag, [field]: 'changed' }])).toThrow('PRESCRIPTION_SCOPE_CHANGED')
    })

  it('requires every original row and refuses an additional occurrence of the same key', () => {
    const scope = freezePrescriptionScope([flag], [flag.checkId])
    expect(() => assertPrescriptionScope(scope, [])).toThrow('PRESCRIPTION_SCOPE_CHANGED')
    expect(() => assertPrescriptionScope(scope, [flag, { ...flag, id: 'flag-2' }])).toThrow('PRESCRIPTION_SCOPE_CHANGED')
    expect(() => assertPrescriptionScope(scope, [flag, { ...flag, id: 'other', checkId: 'different' }])).not.toThrow()
    expect(() => assertPrescriptionScope(freezePrescriptionScope([flag]), [flag, { ...flag, id: 'other', checkId: 'different' }])).toThrow()
  })

  it('accepts only the exact committed guidance on replay while still checking original evidence', () => {
    const scope = freezePrescriptionScope([flag])
    const committed = { ...flag, fix: 'Restore a descriptive title on /pricing' }
    const hashes = new Map([[flag.id, guidanceHash(committed)]])
    expect(() => assertPrescriptionScope(scope, [committed], hashes)).not.toThrow()
    expect(() => assertPrescriptionScope(scope, [{ ...committed, evidence: 'Different observation' }], hashes)).toThrow()
    expect(() => assertPrescriptionScope(scope, [{ ...committed, agentPrompt: 'Unrecorded replacement' }], hashes)).toThrow()
  })

  it('hashes equivalent JSON object order consistently and preserves array membership', () => {
    expect(prescriptionHash({ a: 1, b: { c: 2, d: 3 } })).toBe(prescriptionHash({ b: { d: 3, c: 2 }, a: 1 }))
    expect(prescriptionHash([1, 2])).not.toBe(prescriptionHash([2, 1]))
    expect(freezePrescriptionScope([flag, { ...flag, id: 'second' }])).toEqual(freezePrescriptionScope([{ ...flag, id: 'second' }, flag]))
  })
})
