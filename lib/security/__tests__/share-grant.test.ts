import { createHmac } from 'node:crypto'
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

  it('requires BETTER_AUTH_SECRET to sign a grant', () => {
    process.env.BETTER_AUTH_SECRET = ''
    expect(() =>
      createShareGrant({ linkId: 'link-1', auditId: 'audit-1', linkVersion: 1 })
    ).toThrow('BETTER_AUTH_SECRET')
  })

  it('returns null for missing, malformed, or structurally invalid tokens', () => {
    expect(verifyShareGrant(undefined)).toBeNull()
    expect(verifyShareGrant('')).toBeNull()
    expect(verifyShareGrant('only-one-segment')).toBeNull()
    expect(verifyShareGrant('a.b.c.d')).toBeNull()
    // Tampered signature over a structurally valid payload.
    const grant = createShareGrant({ linkId: 'link-1', auditId: 'audit-1', linkVersion: 1 })
    const [payload] = grant.value.split('.')
    expect(verifyShareGrant(`${payload}.not-the-signature`)).toBeNull()
    // Payload that fails JSON parsing after a valid-looking signature.
    expect(verifyShareGrant('bm90LWpzb24.some-signature')).toBeNull()
  })

  it('rejects claims with wrong version, missing fields, or bad types', () => {
    const secret = process.env.BETTER_AUTH_SECRET!
    const make = (patch: Record<string, unknown>) => {
      const claims = {
        v: 1,
        linkId: 'link-1',
        auditId: 'audit-1',
        linkVersion: 1,
        exp: Math.floor(Date.now() / 1000) + 3_600,
        ...patch,
      }
      const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
      const signature = createHmac('sha256', secret).update(payload).digest('base64url')
      return `${payload}.${signature}`
    }

    expect(verifyShareGrant(make({ v: 2 }))).toBeNull()
    expect(verifyShareGrant(make({ linkId: 42 }))).toBeNull()
    expect(verifyShareGrant(make({ auditId: 42 }))).toBeNull()
    expect(verifyShareGrant(make({ linkVersion: '2' }))).toBeNull()
    expect(verifyShareGrant(make({ exp: '123' }))).toBeNull()
    expect(verifyShareGrant(make({ extra: true }))).toBeNull()
  })

  it('rejects grants that expire at the current second', () => {
    const now = Math.floor(Date.now() / 1000)
    const payload = Buffer.from(
      JSON.stringify({
        v: 1,
        linkId: 'link-1',
        auditId: 'audit-1',
        linkVersion: 1,
        exp: now,
      })
    ).toString('base64url')
    const signature = createHmac('sha256', process.env.BETTER_AUTH_SECRET!)
      .update(payload)
      .digest('base64url')
    expect(verifyShareGrant(`${payload}.${signature}`)).toBeNull()
  })

  it('caps the grant lifetime at 30 days even when a longer expiry is requested', () => {
    const grant = createShareGrant({
      linkId: 'link-1',
      auditId: 'audit-1',
      linkVersion: 1,
      expiresAt: new Date(Date.now() + 100 * 24 * 60 * 60 * 1000),
    })
    const maxMs = 30 * 24 * 60 * 60 * 1000
    expect(grant.expires.getTime() - Date.now()).toBeLessThanOrEqual(maxMs)
    expect(verifyShareGrant(grant.value)).toMatchObject({ linkId: 'link-1', auditId: 'audit-1' })
  })

  it('honors an earlier explicit expiry', () => {
    const inTwoDays = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
    const grant = createShareGrant({
      linkId: 'link-1',
      auditId: 'audit-1',
      linkVersion: 1,
      expiresAt: inTwoDays,
    })
    expect(grant.expires.getTime()).toBeLessThanOrEqual(inTwoDays.getTime())
  })
})
