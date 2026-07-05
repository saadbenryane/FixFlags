import assert from 'node:assert/strict'
import { describe, it, vi } from 'vitest'

const mockUserFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  prisma: {
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
  },
}))

const { assertAuditAccess } = await import('@/lib/mcp/tools')

describe('assertAuditAccess', () => {
  it('always allows the owner, without a DB lookup', async () => {
    await assertAuditAccess({ userId: 'owner-1', isPublic: false }, 'owner-1')
    assert.equal(mockUserFindUnique.mock.calls.length, 0)
  })

  it('always allows anonymous/unclaimed audits, without a DB lookup', async () => {
    await assertAuditAccess({ userId: null, isPublic: false }, 'someone-else')
    assert.equal(mockUserFindUnique.mock.calls.length, 0)
  })

  it('denies a non-owner on a private audit', async () => {
    await assert.rejects(
      () => assertAuditAccess({ userId: 'owner-1', isPublic: false }, 'someone-else'),
      /Unauthorized/
    )
  })

  it('allows a non-owner on a public audit whose owner currently has sharing entitlement', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'owner-1',
      role: 'user',
      plan: 'TEAM',
      subscriptionStatus: 'ACTIVE',
    })
    await assertAuditAccess({ userId: 'owner-1', isPublic: true }, 'someone-else')
  })

  it('denies a non-owner on a public audit whose owner has since lapsed - the stale isPublic bit is not enough', async () => {
    // Regression: the audit's own isPublic flag never gets cleared when the
    // owner's subscription lapses/downgrades, so relying on isPublic alone
    // would keep exposing fix-prompt content to any caller indefinitely.
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'owner-1',
      role: 'user',
      plan: 'TEAM',
      subscriptionStatus: 'PAST_DUE',
    })
    await assert.rejects(
      () => assertAuditAccess({ userId: 'owner-1', isPublic: true }, 'someone-else'),
      /Unauthorized/
    )
  })

  it('denies a non-owner on a public audit whose owner downgraded off TEAM plan', async () => {
    mockUserFindUnique.mockResolvedValueOnce({
      id: 'owner-1',
      role: 'user',
      plan: 'BUILDER',
      subscriptionStatus: 'ACTIVE',
    })
    await assert.rejects(
      () => assertAuditAccess({ userId: 'owner-1', isPublic: true }, 'someone-else'),
      /Unauthorized/
    )
  })
})
