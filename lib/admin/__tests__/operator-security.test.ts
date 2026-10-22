import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  signAdminIntent,
  readAdminIntent,
  revisionHash,
  requireRecentAdminAuthentication,
  safeActivityDetail,
} from '../security'
import { requireAdminOrigin } from '../http'
import { csvCell } from '../exports'
import { refundedCreditBalance } from '@/lib/billing/credits'
import { resolveEffectiveEntitlements } from '@/lib/billing/effective-entitlements'
import { startOf } from '../date-ranges'
import type { EntitlementGrant } from '@prisma/client'
afterEach(() => vi.unstubAllEnvs())
describe('operator security contracts', () => {
  it('detects a tampered intent and a changed target revision', () => {
    vi.stubEnv('BETTER_AUTH_SECRET', 'local-test-secret')
    const token = signAdminIntent({ actorId: 'operator', sessionId: 'one', amount: 123 })
    expect(readAdminIntent(token)).toMatchObject({ amount: 123 })
    expect(() => readAdminIntent(token.slice(0, -1) + (token.endsWith('a') ? 'b' : 'a'))).toThrow()
    expect(revisionHash({ at: new Date('2026-10-13') })).not.toBe(
      revisionHash({ at: new Date('2026-10-14') }),
    )
  })
  it('rejects stale or future authentication', () => {
    const actor = {
      id: 'a',
      email: 'a@local.invalid',
      role: 'admin',
      sessionId: 's',
      authenticatedAt: new Date('2026-10-13T12:00:00Z'),
    }
    expect(() =>
      requireRecentAdminAuthentication(actor, new Date('2026-10-13T12:05:00Z')),
    ).toThrow()
    expect(() =>
      requireRecentAdminAuthentication(actor, new Date('2026-10-13T11:59:00Z')),
    ).toThrow()
  })
  it.each(['https://fixflags.com', 'https://validation.example.test'])('rejects missing, foreign and forged request origins for %s', origin => {
    vi.stubEnv('BETTER_AUTH_URL', origin)
    vi.stubEnv('NEXT_PUBLIC_APP_URL', origin)
    expect(() =>
      requireAdminOrigin(new Request('https://fixflags.com/api/admin/actions')),
    ).toThrow()
    expect(() =>
      requireAdminOrigin(
        new Request('https://fixflags.com/api/admin/actions', {
          headers: { origin: 'https://attacker.invalid' },
        }),
      ),
    ).toThrow()
    expect(() =>
      requireAdminOrigin(
        new Request('https://fixflags.com/api/admin/actions', {
          headers: { origin },
        }),
      ),
    ).not.toThrow()
    expect(() => requireAdminOrigin(new Request('https://attacker.invalid/api/admin/actions', {
      headers: { origin: 'https://attacker.invalid' },
    }))).toThrow()
  })
  it('removes secret fields and credential patterns from durable detail', () => {
    expect(
      safeActivityDetail({
        password: 'secret',
        nested: {
          token: 'secret',
          info: 'user@example.com https://private.invalid sk_test_secret',
        },
      }),
    ).toEqual({ nested: { info: '[email removed] [URL removed] [credential removed]' } })
  })
  it('neutralizes spreadsheet formulas including leading control characters', () => {
    for (const text of ['=HYPERLINK(1)', ' +1', '\t@SUM(1)', '-2'])
      expect(csvCell(text)).toMatch(/^"'/)
    expect(csvCell('a"b')).toBe('"a""b"')
  })
  it('settles only newly refunded credits and preserves consumed credits', () => {
    expect(
      refundedCreditBalance({
        purchased: 10,
        remaining: 7,
        previouslyRefunded: 0,
        refundedMinor: 300,
        paidMinor: 1000,
      }),
    ).toEqual({ refunded: 3, remaining: 4, fullyRefunded: false })
    expect(
      refundedCreditBalance({
        purchased: 10,
        remaining: 4,
        previouslyRefunded: 3,
        refundedMinor: 300,
        paidMinor: 1000,
      }),
    ).toEqual({ refunded: 3, remaining: 4, fullyRefunded: false })
    expect(
      refundedCreditBalance({
        purchased: 10,
        remaining: 4,
        previouslyRefunded: 3,
        refundedMinor: 1000,
        paidMinor: 1000,
      }),
    ).toEqual({ refunded: 10, remaining: 0, fullyRefunded: true })
  })
  it('expires access grants and suspension overrides every allowance', () => {
    const now = new Date('2026-10-13T12:00:00Z'),
      user = {
        id: 'u',
        role: 'user',
        plan: 'FREE' as const,
        subscriptionStatus: 'NONE' as const,
        lifecycleStatus: 'ACTIVE' as const,
        auditsLimit: 3,
        deepReviewsLimit: 1,
        licensedSiteQuantity: 0,
      }
    const grant = {
      id: 'grant',
      plan: 'TEAM',
      siteAllowance: 20,
      scanAllowance: 100,
      deepReviewAllowance: 10,
      allowedWatchIntervals: ['daily'],
      revokedAt: null,
      expiresAt: new Date('2026-10-14T12:00:00Z'),
    } as EntitlementGrant
    expect(resolveEffectiveEntitlements(user, [grant], now)).toMatchObject({
      plan: 'TEAM',
      grantIds: ['grant'],
    })
    expect(
      resolveEffectiveEntitlements(user, [grant], new Date('2026-10-14T12:00:00Z')),
    ).toMatchObject({ plan: 'FREE', grantIds: [] })
    expect(
      resolveEffectiveEntitlements({ ...user, lifecycleStatus: 'SUSPENDED' }, [grant], now),
    ).toMatchObject({ available: false, maxSites: 0, watchIntervals: [] })
  })
  it('uses Casablanca midnight independently of process timezone', () => {
    expect(startOf(0, new Date('2026-10-13T12:00:00Z')).toISOString()).toBe(
      '2026-10-12T23:00:00.000Z',
    )
    expect(startOf(0, new Date('2026-03-01T12:00:00Z')).toISOString()).toBe(
      '2026-03-01T00:00:00.000Z',
    )
  })
})
