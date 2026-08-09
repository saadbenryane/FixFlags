import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createAnonymousClaim, verifyAnonymousClaim } from '@/lib/security/anonymous-claim'

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
