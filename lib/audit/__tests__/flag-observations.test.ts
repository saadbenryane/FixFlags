import { describe, expect, it } from 'vitest'
import { collapseFlagsWithAffectedPaths } from '../flag-identity'
import { mergeSupportingObservations, observationsForFlag, publicSupportingObservations } from '../flag-observations'

const original = { source: 'DETERMINISTIC', checkId: 'buttons-no-text', pageUrl: 'https://example.com/',
  evidence: 'The header action has no accessible name', verificationRule: 'Repeat the accessible-name assertion',
  evidenceTargets: [{ kind: 'element' as const, source: 'measured' as const, device: 'mobile' as const,
    label: 'Header action', selector: '#menu', context: 'private-comparison-scope' }] }
const origin = { auditId: 'before', taskId: 'accessibility', checkVersion: 1, collectedAt: '2026-10-16T10:00:00.000Z' }

describe('supporting observations', () => {
  it('retains the original page, condition, device, evidence and source receipt through collapse', () => {
    const first = { ...original, problem: 'Buttons have no accessible name', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      supportingObservations: observationsForFlag(original, origin) }
    const second = { ...first, pageUrl: 'https://example.com/pricing', evidence: 'The purchase action has no accessible name',
      supportingObservations: observationsForFlag({ ...original, pageUrl: 'https://example.com/pricing', evidence: 'The purchase action has no accessible name' },
        { ...origin, taskId: 'pricing-accessibility' }) }
    const collapsed = collapseFlagsWithAffectedPaths([first, second])[0]
    expect(collapsed.supportingObservations.items).toHaveLength(2)
    expect(collapsed.supportingObservations.items[1]).toMatchObject({ pageUrl: second.pageUrl, evidence: second.evidence,
      checkVersion: 1, provenance: { auditId: 'before', taskId: 'pricing-accessibility' } })
    expect(collapsed.evidence).toContain(second.evidence)
    expect(collapseFlagsWithAffectedPaths([collapsed])[0].supportingObservations).toEqual(collapsed.supportingObservations)
  })

  it('does not invent a check version or source receipt for historical evidence', () => {
    expect(observationsForFlag(original).items[0]).toMatchObject({ checkVersion: null, provenance: null })
  })

  it('deduplicates exact replay without discarding distinct measurements', () => {
    const first = observationsForFlag(original, origin)
    const second = observationsForFlag({ ...original, evidence: 'A second control failed' }, origin)
    expect(mergeSupportingObservations([first, first, second]).items).toHaveLength(2)
  })

  it('fails closed on unsupported versions and omits private comparison context from presentation', () => {
    expect(() => observationsForFlag({ ...original, supportingObservations: { version: 2, items: [] } })).toThrow()
    const visible = publicSupportingObservations(observationsForFlag(original, origin))
    expect(visible[0].references).toEqual([{ device: 'mobile', label: 'Header action', selector: '#menu' }])
    expect(JSON.stringify(visible)).not.toContain('private-comparison-scope')
    expect(publicSupportingObservations({ version: 2, items: [] })).toEqual([])
  })
})
