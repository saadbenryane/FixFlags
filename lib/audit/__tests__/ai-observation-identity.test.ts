import { describe, expect, it } from 'vitest'
import { admitAiObservation, newAiObservationFingerprint } from '../ai-observation-identity'
import { collapseFlagsWithAffectedPaths, observationMatchKeys } from '../flag-identity'
import type { EvidenceTarget } from '../evidence-targets'

const flag = { source: 'AI', rubric: 'EXPERIENCE', severity: 'IMPORTANT', problem: 'Primary action is unclear',
  evidence: 'The mobile action is obscured by the consent dialog.', pageUrl: 'https://example.com/' }
const target: EvidenceTarget = { kind: 'element', source: 'measured', device: 'mobile', selector: '#signup', label: 'Sign up', context: 'consent-open' }

describe('new AI observation admission', () => {
  it('retains distinct evidence and scope even when the model repeats the same title', () => {
    const variants = [flag, { ...flag, evidence: 'The button promise differs from its destination.' },
      { ...flag, pageUrl: 'https://example.com/pricing' }, { ...flag, evidenceTargets: [target] },
      { ...flag, evidenceTargets: [{ ...target, device: 'desktop' as const }] },
      { ...flag, evidenceTargets: [{ ...target, context: 'dialog-closed' }] }]
    const admitted = variants.map(value => admitAiObservation(value))
    expect(new Set(admitted.map(value => value.fingerprint)).size).toBe(variants.length)
    expect(collapseFlagsWithAffectedPaths(admitted)).toHaveLength(variants.length)
    for (const value of admitted) expect(observationMatchKeys(value)).toEqual([value.fingerprint])
  })

  it('deduplicates exact repeated observations independent of target ordering and mutable assessments', () => {
    const other = { ...target, selector: '#secondary' }
    const first = admitAiObservation({ ...flag, evidenceTargets: [target, other] })
    const second = admitAiObservation({ ...flag, severity: 'POLISH', confidence: 0.7, evidenceTargets: [other, target] })
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(collapseFlagsWithAffectedPaths([first, second])).toHaveLength(1)
  })

  it('records the actual task and leaves an unregistered check version unknown', () => {
    const origin = { auditId: 'audit-original', taskId: 'judge-original', collectedAt: '2026-10-16T10:00:00.000Z' }
    const admitted = admitAiObservation(flag, origin)
    expect(admitted.supportingObservations.items[0]).toMatchObject({ source: 'AI', checkId: null, checkVersion: null, provenance: origin })
    expect(admitAiObservation(flag).supportingObservations.items[0].provenance).toBeNull()
    expect(admitAiObservation(admitted, { ...origin, taskId: 'later' })).toEqual(admitted)
  })

  it('preserves an explicitly supplied stored identity and legacy matching behavior', () => {
    expect(newAiObservationFingerprint({ ...flag, fingerprint: 'historical-hash' })).toBe('historical-hash')
    const legacy = observationMatchKeys({ ...flag, fingerprint: 'historical-hash' })
    expect(legacy).toContain('historical-hash')
    expect(legacy).toContain('EXPERIENCE::primary action is unclear')
  })
})
