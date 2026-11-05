import { describe, expect, it } from 'vitest'
import { admittedOutcomeAuthorization, snapshotOutcomeAuthorization } from '../domain/outcome-authorization'

describe('server-owned Outcome authorization', () => {
  it('retains each admitted permission revision separately from the check definition', () => {
    const snapshot = snapshotOutcomeAuthorization([{ id: 'pricing', authorizationRevision: 2 }, { id: 'signup', authorizationRevision: 7 }])
    expect(admittedOutcomeAuthorization({ outcomeAuthorization: snapshot }, 'pricing')).toBe(2)
    expect(admittedOutcomeAuthorization({ outcomeAuthorization: snapshot }, 'signup')).toBe(7)
  })

  it('assigns retained requests only the migration baseline, never renewed permission', () => {
    expect(admittedOutcomeAuthorization(null, 'pricing')).toBe(1)
    expect(admittedOutcomeAuthorization({ previousRunId: 'retained' }, 'pricing')).toBe(1)
  })

  it('does not treat malformed or missing recorded membership as retained permission', () => {
    for (const snapshot of [null, {}, { version: 2, outcomes: [] }, { version: 1, outcomes: [] },
      { version: 1, outcomes: [{ id: 'pricing', revision: 1 }, { id: 'pricing', revision: 2 }] }])
      expect(admittedOutcomeAuthorization({ outcomeAuthorization: snapshot }, 'pricing')).toBeNull()
  })

  it('refuses new snapshots with missing authority or ambiguous membership', () => {
    expect(() => snapshotOutcomeAuthorization([{ id: 'pricing', authorizationRevision: 0 }])).toThrow()
    expect(() => snapshotOutcomeAuthorization([{ id: 'pricing', authorizationRevision: 1 }, { id: 'pricing', authorizationRevision: 1 }])).toThrow()
  })
})
