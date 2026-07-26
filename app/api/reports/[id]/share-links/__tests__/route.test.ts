import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  shareLink: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const canManageAudit = vi.hoisted(() => vi.fn())
const canSharePublicly = vi.hoisted(() => vi.fn())
const hashSharePassword = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/audit/access', () => ({ canManageAudit }))
vi.mock('@/lib/auth/entitlements', () => ({ canSharePublicly }))
vi.mock('@/lib/security/share-password', () => ({ hashSharePassword }))

import { DELETE, GET, POST } from '@/app/api/reports/[id]/share-links/route'

const owner = { id: 'user-1', plan: 'TEAM', role: 'user', subscriptionStatus: 'ACTIVE' }

describe('/api/reports/[id]/share-links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    canManageAudit.mockReturnValue(true)
    canSharePublicly.mockReturnValue(true)
    hashSharePassword.mockResolvedValue('hashed')
    prismaMock.audit.findUnique.mockResolvedValue({
      id: 'audit-1',
      userId: 'user-1',
      status: 'COMPLETED',
      isPublic: false,
    })
    prismaMock.user.findUnique.mockResolvedValue(owner)
  })

  it('lists share links for the owner', async () => {
    prismaMock.shareLink.findMany.mockResolvedValue([{ id: 'share-1', revoked: false }])
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: 'audit-1' }) })
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ id: 'share-1', revoked: false }])
  })

  it('rejects unsigned list requests', async () => {
    getSession.mockResolvedValue(null)
    canManageAudit.mockReturnValue(false)
    const response = await GET({} as NextRequest, { params: Promise.resolve({ id: 'audit-1' }) })
    expect(response.status).toBe(401)
  })

  it('creates a Studio share link and rejects Free users', async () => {
    prismaMock.shareLink.create.mockResolvedValue({ id: 'share-2', token: 'tok', revoked: false })
    const created = await POST(
      new NextRequest('http://localhost/api/reports/audit-1/share-links', {
        method: 'POST',
        body: JSON.stringify({ password: 'long-enough-password' }),
      }),
      { params: Promise.resolve({ id: 'audit-1' }) }
    )
    expect(created.status).toBe(200)
    expect(hashSharePassword).toHaveBeenCalledWith('long-enough-password')

    canSharePublicly.mockReturnValue(false)
    const denied = await POST(
      new NextRequest('http://localhost/api/reports/audit-1/share-links', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'audit-1' }) }
    )
    expect(denied.status).toBe(402)
    expect((await denied.json()).code).toBe('UPGRADE_REQUIRED')
  })

  it('rejects short passwords and missing audits', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce(null)
    const missing = await POST(
      new NextRequest('http://localhost/api/reports/missing/share-links', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'missing' }) }
    )
    expect(missing.status).toBe(404)

    prismaMock.audit.findUnique.mockResolvedValue({
      id: 'audit-1',
      userId: 'user-1',
      status: 'COMPLETED',
      isPublic: false,
    })
    const invalid = await POST(
      new NextRequest('http://localhost/api/reports/audit-1/share-links', {
        method: 'POST',
        body: JSON.stringify({ password: 'short' }),
      }),
      { params: Promise.resolve({ id: 'audit-1' }) }
    )
    expect(invalid.status).toBe(400)
  })

  it('revokes a share link for the owner', async () => {
    prismaMock.shareLink.findUnique.mockResolvedValue({
      id: 'share-1',
      audit: { id: 'audit-1', userId: 'user-1' },
    })
    prismaMock.shareLink.update.mockResolvedValue({ id: 'share-1', revoked: true })
    const response = await DELETE(
      new NextRequest('http://localhost/api/reports/audit-1/share-links?shareId=share-1')
    )
    expect(response.status).toBe(200)
    expect(prismaMock.shareLink.update).toHaveBeenCalledWith({
      where: { id: 'share-1' },
      data: { revoked: true },
    })
  })

  it('requires shareId to revoke', async () => {
    const response = await DELETE(
      new NextRequest('http://localhost/api/reports/audit-1/share-links')
    )
    expect(response.status).toBe(400)
  })
})
