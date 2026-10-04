import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createAnonymousClaim,
  createAnonymousClaims,
  readAnonymousClaimIds,
  verifyAnonymousClaim,
} from '@/lib/security/anonymous-claim'

const original = process.env.BETTER_AUTH_SECRET

describe('anonymous claim proof', () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-anonymous-claim-secret-at-least-32-chars'
  })
  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = original
  })

  it('round trips a scoped audit claim', () => {
    const now = Date.parse('2026-08-09T00:00:00Z')
    expect(verifyAnonymousClaim(createAnonymousClaim('audit-1', now), now)).toMatchObject({
      auditId: 'audit-1', v: 1,
    })
  })

  it('rejects tampering, unsigned ids, and expiration', () => {
    const now = Date.parse('2026-08-09T00:00:00Z')
    const token = createAnonymousClaim('audit-1', now)
    expect(verifyAnonymousClaim(`${token}x`, now)).toBeNull()
    expect(verifyAnonymousClaim('["audit-1"]', now)).toBeNull()
    expect(verifyAnonymousClaim(token, now + 31 * 24 * 60 * 60 * 1000)).toBeNull()
  })
})

describe('anonymous claim ids', () => {
  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-anonymous-claim-secret-at-least-32-chars'
  })
  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = original
  })

  const now = Date.parse('2026-08-09T00:00:00Z')

  it('preserves the given order so newest-first truncation is meaningful', () => {
    expect(readAnonymousClaimIds(createAnonymousClaims(['new', 'old'], now), now)).toEqual(['new', 'old'])
  })

  it('deduplicates and caps the tracked list', () => {
    const many = Array.from({ length: 12 }, (_, i) => `audit-${i}`)
    const ids = readAnonymousClaimIds(createAnonymousClaims([...many, 'audit-11'], now), now)
    expect(ids).toHaveLength(8)
    expect(new Set(ids).size).toBe(8)
    // The newest ids survive; the oldest are the ones a repeat visitor has moved past.
    expect(ids[0]).toBe('audit-0')
  })

  it('reads a single-id claim as a one-element list', () => {
    expect(readAnonymousClaimIds(createAnonymousClaim('audit-1', now), now)).toEqual(['audit-1'])
  })

  it('yields nothing for unsigned, tampered, or expired values', () => {
    const token = createAnonymousClaims(['audit-1'], now)
    expect(readAnonymousClaimIds('["audit-1"]', now)).toEqual([])
    expect(readAnonymousClaimIds(`${token}x`, now)).toEqual([])
    expect(readAnonymousClaimIds(undefined, now)).toEqual([])
    expect(readAnonymousClaimIds(token, now + 31 * 24 * 60 * 60 * 1000)).toEqual([])
  })

  it('drops malformed entries instead of handing callers a non-string id', () => {
    expect(readAnonymousClaimIds(createAnonymousClaims(['ok', '', null as never, 7 as never], now), now))
      .toEqual(['ok'])
  })
})
