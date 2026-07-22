import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  createShareGrant,
  SHARE_GRANT_COOKIE,
  verifyShareGrant,
} from '@/lib/security/share-grant'

describe('share grants', () => {
  const original = process.env.BETTER_AUTH_SECRET

  beforeEach(() => {
    process.env.BETTER_AUTH_SECRET = 'test-share-secret-that-is-long-enough'
  })

  afterEach(() => {
    process.env.BETTER_AUTH_SECRET = original
  })

  it('creates a link-scoped signed grant', () => {
    const grant = createShareGrant({ linkId: 'link-1', auditId: 'audit-1', linkVersion: 2 })
    expect(verifyShareGrant(grant.value)).toMatchObject({
      linkId: 'link-1',
      auditId: 'audit-1',
      linkVersion: 2,
    })
    expect(SHARE_GRANT_COOKIE).toBe('ff_share_grant')
  })

  it('rejects tampering and expired grants', () => {
    const grant = createShareGrant({
      linkId: 'link-1',
      auditId: 'audit-1',
      linkVersion: 1,
      expiresAt: new Date(Date.now() - 1_000),
    })
    expect(verifyShareGrant(grant.value)).toBeNull()
    expect(verifyShareGrant(`${grant.value}x`)).toBeNull()
  })
})
