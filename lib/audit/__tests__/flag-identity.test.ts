import { consolidateFlagsByCheck } from '@/lib/audit/consolidate-flags'
import { observationsForFlag, publicSupportingObservations } from '@/lib/audit/flag-observations'
import { describe, expect, it } from 'vitest'
import {
  baseCheckId,
  collapseFlagsWithAffectedPaths,
  durableCheckId,
  flagFingerprint,
  observationIdentity,
  observationMatchKeys,
} from '@/lib/audit/flag-identity'

describe('Flag identity', () => {
  it('retains independent AI diagnoses in report consolidation and merges support for declared equivalent native checks', () => {
    const base = { id: 'native', checkId: 'buttons-no-text', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Unnamed control', evidence: 'Button has no accessible name', source: 'DETERMINISTIC', pageUrl: 'https://example.com/' }
    const first = { ...base, supportingObservations: observationsForFlag(base,
      { auditId: 'a1', taskId: 't1', collectedAt: '2026-10-17T03:00:00.000Z', checkVersion: 1 }) }
    const second = { ...base, id: 'native-2', pageUrl: 'https://example.com/pricing', supportingObservations: observationsForFlag({ ...base, pageUrl: 'https://example.com/pricing' },
      { auditId: 'a1', taskId: 't2', collectedAt: '2026-10-17T03:01:00.000Z', checkVersion: 1 }) }
    const native = consolidateFlagsByCheck([first, second])
    expect(native).toHaveLength(1)
    expect(native[0].supportingObservations).toMatchObject({ items: expect.arrayContaining([
      expect.objectContaining({ provenance: expect.objectContaining({ taskId: 't1' }) }),
      expect.objectContaining({ provenance: expect.objectContaining({ taskId: 't2' }) }),
    ]) })
    const ai = [
      { ...base, source: 'AI', fingerprint: 'ai-observation:v1::first' },
      { ...base, id: 'ai-2', source: 'AI', fingerprint: 'ai-observation:v1::second' },
    ]
    expect(consolidateFlagsByCheck(ai)).toHaveLength(2)
  })

  it('preserves public observation views without reintroducing comparison context or provenance', () => {
    const original = { source: 'DETERMINISTIC', checkId: 'buttons-no-text', pageUrl: 'https://example.com/',
      evidence: 'Recorded control has no name', verificationRule: 'private-rule',
      evidenceTargets: [{ kind: 'element' as const, source: 'measured' as const, device: 'desktop' as const,
        label: 'Control', context: 'private-context' }] }
    const visible = publicSupportingObservations(observationsForFlag(original,
      { auditId: 'private-audit', taskId: 'private-task', collectedAt: '2026-10-17T03:00:00.000Z', checkVersion: 1 }))
    const result = consolidateFlagsByCheck([{ ...original, id: 'public', rubric: 'EXPERIENCE', severity: 'IMPORTANT',
      problem: 'Unnamed control', supportingObservations: visible }])
    expect(result[0]!.supportingObservations).toEqual(visible)
    expect(JSON.stringify(result[0]!.supportingObservations)).not.toMatch(/private-context|private-audit|private-task|private-rule/)
  })

  it('removes page occurrence suffixes without losing the durable check', () => {
    expect(baseCheckId('cta-dead-link::page:2')).toBe('cta-dead-link')
    expect(flagFingerprint({
      checkId: 'cta-dead-link::page:2',
      problem: 'The action is broken',
      rubric: 'EXPERIENCE',
    })).toBe('check:cta-dead-link')
  })

  it('groups equivalent journey checks under a Product-level identity', () => {
    expect(durableCheckId('journey-signup-hidden-cta')).toBe('journey-hidden-cta')
    expect(durableCheckId('journey-pricing-evaluation-dead-end')).toBe(
      'journey-dead-end'
    )
  })

  it('uses semantic identity only when a durable check does not exist', () => {
    const fingerprint = flagFingerprint({
      checkId: null,
      problem: 'The promise is unclear',
      rubric: 'MESSAGE',
    })
    expect(fingerprint).toContain('MESSAGE')
  })

  it('keeps a stored AI identity when the title is restated', () => {
    const stored = observationIdentity({
      checkId: null,
      problem: 'The promise is unclear',
      rubric: 'MESSAGE',
    })
    expect(
      observationIdentity({
        checkId: null,
        problem: 'Homepage promise still does not name who it is for',
        rubric: 'MESSAGE',
        fingerprint: stored,
      })
    ).toBe(stored)
  })

  it('matches journey aliases and stored hashes onto one identity', () => {
    const keys = observationMatchKeys({
      checkId: 'journey-signup-hidden-cta',
      problem: 'No obvious primary CTA',
      rubric: 'EXPERIENCE',
    })
    expect(keys).toContain('check:journey-hidden-cta')
    expect(
      observationMatchKeys({
        checkId: null,
        problem: 'Headline is vague',
        rubric: 'MESSAGE',
        fingerprint: 'a'.repeat(64),
      })
    ).toContain('a'.repeat(64))
  })

  it('collapses the same check across pages into one Flag with affectedPaths', () => {
    const collapsed = collapseFlagsWithAffectedPaths([
      {
        checkId: 'cta-unclear',
        problem: 'The action is unclear',
        rubric: 'MESSAGE',
        severity: 'IMPORTANT',
        evidence: 'On /',
        pageUrl: 'https://example.com/',
      },
      {
        checkId: 'cta-unclear',
        problem: 'The action is unclear',
        rubric: 'MESSAGE',
        severity: 'CRITICAL',
        evidence: 'On /pricing',
        pageUrl: 'https://example.com/pricing',
      },
    ])
    expect(collapsed).toHaveLength(1)
    expect(collapsed[0]?.severity).toBe('CRITICAL')
    expect(collapsed[0]?.affectedPaths).toEqual([
      'https://example.com/',
      'https://example.com/pricing',
    ])
  })
  it('preserves scoped evidence across phases without drawing another page over the representative capture', () => {
    const target = { kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const, label: 'Library', context: 'tracking:page_load:library:page:one' }
    const flag = { checkId: 'tracking-library-http-error', problem: 'Library error', rubric: 'REACH', severity: 'IMPORTANT', pageUrl: 'https://example.com/', evidence: 'Initial error', evidenceTargets: [target] }
    const collapsed = collapseFlagsWithAffectedPaths([flag, { ...flag, evidence: 'Later error', evidenceTargets: [{ ...target, context: 'tracking:public_action:library:page:one' }] },
      { ...flag, pageUrl: 'https://example.com/other', evidenceTargets: [{ ...target, context: 'tracking:page_load:library:page:two', rect: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 } }] }])
    expect(collapsed[0].evidenceTargets).toHaveLength(3)
    expect(collapsed[0].evidence).toContain('Later error')
    expect(collapsed[0].evidenceTargets![2].rect).toBeUndefined()
  })

})
