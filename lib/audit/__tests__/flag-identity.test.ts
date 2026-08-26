import { describe, expect, it } from 'vitest'
import { baseCheckId, durableCheckId, flagFingerprint, collapseFlagsWithAffectedPaths } from '@/lib/audit/flag-identity'

describe('Flag identity', () => {
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
})
