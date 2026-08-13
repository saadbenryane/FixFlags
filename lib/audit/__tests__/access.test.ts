import { describe, expect, it, vi, beforeEach } from 'vitest'
import type { Audit } from '@prisma/client'

const dbMocks = vi.hoisted(() => ({
  userFindUnique: vi.fn<() => Promise<unknown>>(),
  shareLinkFindUnique: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: dbMocks.userFindUnique,
    },
    shareLink: {
      findUnique: dbMocks.shareLinkFindUnique,
    },
  },
}))

vi.mock('@/lib/auth/entitlements', () => ({
  canSharePublicly: vi.fn(),
}))

vi.mock('@/lib/security/share-grant', () => ({
  verifyShareGrant: vi.fn(),
}))

import { canSharePublicly } from '@/lib/auth/entitlements'
import { verifyShareGrant } from '@/lib/security/share-grant'
import type { ShareGrantClaims } from '@/lib/security/share-grant'
import {
  canAccessAudit,
  canManageAudit,
  canRetryAnonymousAudit,
  resolveAuditAccess,
} from '@/lib/audit/access'

const mockedUserFindUnique = dbMocks.userFindUnique
const mockedShareLinkFindUnique = dbMocks.shareLinkFindUnique
const mockedCanSharePublicly = vi.mocked(canSharePublicly)
const mockedVerifyShareGrant = vi.mocked(verifyShareGrant)

type AuditPick = Pick<Audit, 'id' | 'userId' | 'isPublic'>

function makeAudit(overrides: Partial<AuditPick> = {}): AuditPick {
  return {
    id: 'audit-1',
    userId: 'user-1',
    isPublic: false,
    ...overrides,
  }
}

function grantClaims(overrides: Partial<ShareGrantClaims> = {}): ShareGrantClaims {
  return {
    v: 1,
    auditId: 'audit-1',
    linkId: 'link-1',
    linkVersion: 1,
    exp: Math.floor(Date.now() / 1000) + 60,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('canAccessAudit', () => {
  it('returns true for public audit', () => {
    expect(canAccessAudit(makeAudit({ isPublic: true }), null)).toBe(true)
  })

  it('returns true for audit with null userId', () => {
    expect(canAccessAudit(makeAudit({ userId: null, isPublic: false }), null)).toBe(true)
  })

  it('returns true when session user owns the audit', () => {
    expect(canAccessAudit(makeAudit({ userId: 'user-1' }), { id: 'user-1' })).toBe(true)
  })

  it('returns false when session user does not own the audit', () => {
    expect(canAccessAudit(makeAudit({ userId: 'user-1' }), { id: 'user-2' })).toBe(false)
  })

  it('returns false for private audit with no session user', () => {
    expect(canAccessAudit(makeAudit({ userId: 'user-1' }), null)).toBe(false)
  })

  it('returns false for private audit with undefined session user', () => {
    expect(canAccessAudit(makeAudit({ userId: 'user-1' }), undefined)).toBe(false)
  })
})

describe('canManageAudit', () => {
  it('returns false when audit has no userId', () => {
    expect(canManageAudit(makeAudit({ userId: null }), { id: 'user-1' })).toBe(false)
  })

  it('returns true when session user owns the audit', () => {
    expect(canManageAudit(makeAudit({ userId: 'user-1' }), { id: 'user-1' })).toBe(true)
  })

  it('returns false when session user does not own the audit', () => {
    expect(canManageAudit(makeAudit({ userId: 'user-1' }), { id: 'user-2' })).toBe(false)
  })

  it('returns false when no session user', () => {
    expect(canManageAudit(makeAudit({ userId: 'user-1' }), null)).toBe(false)
  })

  it('returns false when session user is undefined', () => {
    expect(canManageAudit(makeAudit({ userId: 'user-1' }), undefined)).toBe(false)
  })
})

describe('canRetryAnonymousAudit', () => {
  it('returns false for audit with userId', () => {
    expect(canRetryAnonymousAudit(makeAudit({ userId: 'user-1', isPublic: false }), 'audit-1', ['audit-1'])).toBe(false)
  })

  it('returns false for public audit', () => {
    expect(canRetryAnonymousAudit(makeAudit({ userId: null, isPublic: true }), 'audit-1', ['audit-1'])).toBe(false)
  })

  it('returns true when anonAuditIds includes the auditId', () => {
    expect(canRetryAnonymousAudit(makeAudit({ userId: null, isPublic: false }), 'audit-1', ['audit-1'])).toBe(true)
  })

  it('returns false when anonAuditIds does not include the auditId', () => {
    expect(canRetryAnonymousAudit(makeAudit({ userId: null, isPublic: false }), 'audit-1', ['audit-2'])).toBe(false)
  })

  it('returns false when anonAuditIds is empty', () => {
    expect(canRetryAnonymousAudit(makeAudit({ userId: null, isPublic: false }), 'audit-1', [])).toBe(false)
  })
})

describe('resolveAuditAccess', () => {
  beforeEach(() => {
    mockedUserFindUnique.mockResolvedValue(null)
    mockedShareLinkFindUnique.mockResolvedValue(null)
    mockedCanSharePublicly.mockReturnValue(false)
    mockedVerifyShareGrant.mockReturnValue(null)
  })

  it('returns owner when session user owns the audit', async () => {
    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1' }),
      { id: 'user-1' },
      undefined
    )
    expect(result).toBe('owner')
  })

  it('returns anonymous_teaser when audit has null userId and is not public', async () => {
    const result = await resolveAuditAccess(
      makeAudit({ userId: null, isPublic: false }),
      null,
      undefined
    )
    expect(result).toBe('anonymous_teaser')
  })

  it('returns marketing_sample when audit has null userId and is public', async () => {
    const result = await resolveAuditAccess(
      makeAudit({ userId: null, isPublic: true }),
      null,
      undefined
    )
    expect(result).toBe('marketing_sample')
  })

  it('returns studio_public when audit is public and owner can share publicly', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
      plan: 'TEAM',
      subscriptionStatus: 'ACTIVE',
    })
    mockedCanSharePublicly.mockReturnValue(true)

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      undefined
    )
    expect(result).toBe('studio_public')
    expect(mockedUserFindUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { id: true, role: true, plan: true, subscriptionStatus: true },
    })
  })

  it('returns denied when share grant verification fails', async () => {
    mockedUserFindUnique.mockResolvedValue({
      id: 'user-1',
      role: 'user',
      plan: 'FREE',
      subscriptionStatus: 'NONE',
    })
    mockedCanSharePublicly.mockReturnValue(false)
    mockedVerifyShareGrant.mockReturnValue(null)

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'invalid-grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share grant auditId does not match', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims({ auditId: 'other-audit' }))

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share link not found', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims())
    mockedShareLinkFindUnique.mockResolvedValue(null)

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share link auditId does not match', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims())
    mockedShareLinkFindUnique.mockResolvedValue({
      auditId: 'other-audit',
      version: 1,
      revoked: false,
      expiresAt: null,
      audit: { user: { id: 'user-1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' } },
    })

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share link version does not match', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims({ linkVersion: 2 }))
    mockedShareLinkFindUnique.mockResolvedValue({
      auditId: 'audit-1',
      version: 1,
      revoked: false,
      expiresAt: null,
      audit: { user: { id: 'user-1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' } },
    })

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share link is revoked', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims())
    mockedShareLinkFindUnique.mockResolvedValue({
      auditId: 'audit-1',
      version: 1,
      revoked: true,
      expiresAt: null,
      audit: { user: { id: 'user-1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' } },
    })

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share link is expired', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims())
    mockedShareLinkFindUnique.mockResolvedValue({
      auditId: 'audit-1',
      version: 1,
      revoked: false,
      expiresAt: new Date('2020-01-01'),
      audit: { user: { id: 'user-1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' } },
    })

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when share link user cannot share publicly', async () => {
    mockedVerifyShareGrant.mockReturnValue(grantClaims())
    mockedShareLinkFindUnique.mockResolvedValue({
      auditId: 'audit-1',
      version: 1,
      revoked: false,
      expiresAt: null,
      audit: {
        user: {
          id: 'user-1',
          role: 'user',
          plan: 'FREE',
          subscriptionStatus: 'NONE',
        },
      },
    })
    mockedCanSharePublicly.mockReturnValue(false)

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: true }),
      { id: 'user-2' },
      'grant'
    )
    expect(result).toBe('denied')
  })

  it('returns denied when no session user and audit has userId', async () => {
    mockedVerifyShareGrant.mockReturnValue(null)

    const result = await resolveAuditAccess(
      makeAudit({ userId: 'user-1', isPublic: false }),
      null,
      undefined
    )
    expect(result).toBe('denied')
  })
})
