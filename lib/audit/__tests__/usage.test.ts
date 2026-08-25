import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  audit: {
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))
const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  getAll: vi.fn(() => []),
  delete: vi.fn(),
}))
const headerStore = vi.hoisted(() => ({
  get: vi.fn<(name: string) => string | null>(() => null),
}))
const consumePurchasedCredit = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ cookies: async () => cookieStore, headers: async () => headerStore }))
vi.mock('@/lib/billing/credits', () => ({ consumePurchasedCredit }))
vi.mock('@/lib/security/rate-limit', () => ({ enforceRateLimit }))

import {
  ANON_AUDIT_IDS_COOKIE,
  ANON_IP_SOFT_LIMIT,
  ANON_IP_SOFT_WINDOW_SECONDS,
  checkAnonymousAuditAllowed,
  enforceAnonymousIpSoftCeiling,
  incrementUsageOnCompleteForAudit,
  readAnonAuditIds,
  readAnonAuditIdsFromStore,
  claimsAnonymousReport,
  trackAnonymousAuditId,
} from '@/lib/audit/usage'
import { createAnonymousClaim } from '@/lib/security/anonymous-claim'

process.env.BETTER_AUTH_SECRET = 'test-anonymous-claim-secret-at-least-32-chars'

function passthroughTx() {
  prismaMock.$transaction.mockImplementation(
    async (operation: (tx: unknown) => unknown) => operation(prismaMock)
  )
}

describe('readAnonAuditIds', () => {
  it('returns an empty list for missing or invalid cookies', () => {
    expect(readAnonAuditIds(undefined)).toEqual([])
    expect(readAnonAuditIds('not-json')).toEqual([])
    expect(readAnonAuditIds('{"object":true}')).toEqual([])
    expect(readAnonAuditIds('"string"')).toEqual([])
  })

  it('accepts only a valid signed claim', () => {
    expect(readAnonAuditIds(createAnonymousClaim('a'))).toEqual(['a'])
    expect(readAnonAuditIds('["a","b"]')).toEqual([])
  })

  it('skips a stale host-only value when a signed Domain cookie is also present', () => {
    const signed = createAnonymousClaim('teaser-1')
    expect(
      readAnonAuditIdsFromStore({
        get: () => ({ value: '["stale"]' }),
        getAll: () => [
          { name: 'ff_anon_report_ids', value: '["stale"]' },
          { name: 'ff_anon_report_ids', value: signed },
        ],
      })
    ).toEqual(['teaser-1'])
  })

  it('treats parent and child report ids as the same anonymous session', () => {
    expect(claimsAnonymousReport(['parent-1'], 'parent-1')).toBe(true)
    expect(claimsAnonymousReport(['parent-1'], 'child-1', 'parent-1')).toBe(true)
    expect(claimsAnonymousReport(['parent-1'], 'other', null)).toBe(false)
  })
})

describe('checkAnonymousAuditAllowed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.get.mockReturnValue(undefined)
  })

  it('allows a first-time visitor with no teaser cookie', async () => {
    await expect(checkAnonymousAuditAllowed()).resolves.toEqual({ allowed: true })
    expect(prismaMock.audit.count).not.toHaveBeenCalled()
  })

  it('blocks when a tracked teaser audit still exists', async () => {
    cookieStore.get.mockReturnValue({ value: createAnonymousClaim('teaser-1') })
    prismaMock.audit.count.mockResolvedValueOnce(1)
    const result = await checkAnonymousAuditAllowed()
    expect(result).toMatchObject({
      allowed: false,
      code: 'AUTH_REQUIRED',
      action: 'signup',
    })
    expect(result.error).toContain('free scan')
    expect(prismaMock.audit.count).toHaveBeenCalledWith({
      where: { id: { in: ['teaser-1'] }, userId: null },
    })
  })

  it('allows again when the tracked audit no longer exists (stale cookie)', async () => {
    cookieStore.get.mockReturnValue({ value: createAnonymousClaim('deleted-audit') })
    prismaMock.audit.count.mockResolvedValueOnce(0)
    await expect(checkAnonymousAuditAllowed()).resolves.toEqual({ allowed: true })
  })
})

describe('enforceAnonymousIpSoftCeiling', () => {
  it('enforces the one-scan-per-day soft ceiling for the client id', async () => {
    enforceRateLimit.mockResolvedValueOnce(undefined)
    await enforceAnonymousIpSoftCeiling('client-ip-1')
    expect(enforceRateLimit).toHaveBeenCalledWith({
      scope: 'anon-teaser-ip',
      identifier: 'client-ip-1',
      limit: ANON_IP_SOFT_LIMIT,
      windowSeconds: ANON_IP_SOFT_WINDOW_SECONDS,
    })
  })
})

describe('trackAnonymousAuditId', () => {
  it('persists the audit id in an httpOnly cookie', async () => {
    await trackAnonymousAuditId('teaser-1')
    expect(cookieStore.set).toHaveBeenCalledWith(
      ANON_AUDIT_IDS_COOKIE,
      expect.stringMatching(/^[^.]+\.[^.]+$/),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', path: '/' })
    )
  })

  it('scopes the claim cookie to www and apex of the product host', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixflags.com')
    await trackAnonymousAuditId('teaser-1')
    expect(cookieStore.set).toHaveBeenCalledWith(
      ANON_AUDIT_IDS_COOKIE,
      expect.any(String),
      expect.objectContaining({ domain: '.fixflags.com', path: '/' })
    )
    expect(cookieStore.set).toHaveBeenCalledWith(
      ANON_AUDIT_IDS_COOKIE,
      '',
      expect.objectContaining({ maxAge: 0, path: '/' })
    )
    vi.unstubAllEnvs()
  })

  it('scopes the claim from the request Host when APP_URL is Railway', async () => {
    vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://fixflags-prod.up.railway.app')
    headerStore.get.mockImplementation((name: string) =>
      name === 'host' ? 'www.fixflags.com' : null
    )
    await trackAnonymousAuditId('teaser-1')
    expect(cookieStore.set).toHaveBeenCalledWith(
      ANON_AUDIT_IDS_COOKIE,
      expect.any(String),
      expect.objectContaining({ domain: '.fixflags.com', path: '/' })
    )
    vi.unstubAllEnvs()
    headerStore.get.mockReturnValue(null)
  })
})

describe('incrementUsageOnCompleteForAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    passthroughTx()
  })

  it('is a no-op when the audit is missing or belongs to another user', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce(null)
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: null,
      userId: 'user-2',
      skipUsageCount: false,
    })
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).not.toHaveBeenCalled()
  })

  it('is idempotent for an already-counted audit', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: new Date(),
      userId: 'user-1',
      skipUsageCount: false,
    })
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).not.toHaveBeenCalled()
  })

  it('marks counted but never increments for watch-triggered re-checks', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: null,
      userId: 'user-1',
      skipUsageCount: true,
    })
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { usageCountedAt: expect.any(Date) },
    })
  })

  it('marks counted without incrementing for unlimited users', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: null,
      userId: 'user-1',
      skipUsageCount: false,
    })
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'admin' })
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).toHaveBeenCalled()
  })

  it('increments used checks when under the plan limit', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: null,
      userId: 'user-1',
      skipUsageCount: false,
    })
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'user' })
    prismaMock.user.findUnique.mockResolvedValueOnce({ auditsUsed: 1, auditsLimit: 3 })
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { auditsUsed: { increment: 1 } },
    })
    expect(consumePurchasedCredit).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).toHaveBeenCalled()
  })

  it('consumes a purchased credit when the plan quota is exhausted', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: null,
      userId: 'user-1',
      skipUsageCount: false,
    })
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'user' })
    prismaMock.user.findUnique.mockResolvedValueOnce({ auditsUsed: 3, auditsLimit: 3 })
    consumePurchasedCredit.mockResolvedValueOnce(true)
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(consumePurchasedCredit).toHaveBeenCalled()
    expect(prismaMock.user.update).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).toHaveBeenCalled()
  })

  it('still counts the check when no credit is left (grace overflow)', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({
      usageCountedAt: null,
      userId: 'user-1',
      skipUsageCount: false,
    })
    prismaMock.user.findUnique.mockResolvedValueOnce({ role: 'user' })
    prismaMock.user.findUnique.mockResolvedValueOnce({ auditsUsed: 3, auditsLimit: 3 })
    consumePurchasedCredit.mockResolvedValueOnce(false)
    await incrementUsageOnCompleteForAudit('audit-1', 'user-1')
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { auditsUsed: { increment: 1 } },
    })
  })
})
