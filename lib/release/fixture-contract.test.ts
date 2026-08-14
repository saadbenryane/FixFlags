import { describe, expect, it } from 'vitest'
import {
  assertNonProductionReleaseTarget,
  canonicalReleaseDatabaseIdentity,
  releaseDatabaseIdentityHash,
  RELEASE_FIXTURE_ROLES,
} from './fixture-contract'

describe('release fixture contract', () => {
  it('binds the database independently of query parameters and credentials', () => {
    const first = 'postgresql://first@db.example:5432/fixflags_release?schema=public'
    const second = 'postgresql://second@db.example/fixflags_release?sslmode=require'
    expect(canonicalReleaseDatabaseIdentity(first)).toBe(canonicalReleaseDatabaseIdentity(second))
    expect(releaseDatabaseIdentityHash(first)).toBe(releaseDatabaseIdentityHash(second))
  })

  it('rejects non-disposable databases and production targets', () => {
    expect(() => canonicalReleaseDatabaseIdentity('postgresql://user@db.example/fixflags')).toThrow(/release or test/)
    expect(() => assertNonProductionReleaseTarget('https://fixflags.com')).toThrow(/never target production/)
  })

  it('uses distinct roles instead of ambiguous account fallbacks', () => {
    expect(new Set(RELEASE_FIXTURE_ROLES.map((role) => role.key)).size).toBe(RELEASE_FIXTURE_ROLES.length)
    expect(RELEASE_FIXTURE_ROLES.find((role) => role.key === 'pro')?.plan).toBe('BUILDER')
    expect(RELEASE_FIXTURE_ROLES.find((role) => role.key === 'studio')?.plan).toBe('TEAM')
  })
})
