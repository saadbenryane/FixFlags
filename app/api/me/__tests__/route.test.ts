import { beforeEach, describe, expect, it, vi } from 'vitest'

const getSession = vi.hoisted(() => vi.fn())
const findUnique = vi.hoisted(() => vi.fn())
const recordRateLimit = vi.hoisted(() => vi.fn())
const serializeMeUser = vi.hoisted(() => vi.fn())
const claimAnonymousAudits = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit,
  enforceRateLimit,
  requestClientId: () => 'test-client',
}))
vi.mock('@/lib/auth/me-user', () => ({
  meUserSelect: { id: true },
  serializeMeUser,
}))
vi.mock('@/lib/audit/claim-anonymous', () => ({ claimAnonymousAudits }))

import { GET } from '@/app/api/me/route'
import { POST } from '@/app/api/me/claim/route'
import { ProductLimitReached } from '@/lib/billing/product-capacity'

describe('/api/me', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'person@example.com', name: 'Person' },
    })
    findUnique.mockResolvedValue({ id: 'user-1' })
    serializeMeUser.mockResolvedValue({ id: 'user-1', email: 'person@example.com' })
    claimAnonymousAudits.mockResolvedValue(2)
  })

  it('keeps GET read-only even when a legacy claim query is present', async () => {
    const response = await GET(new Request('http://localhost/api/me?claim=1'))
    expect(response.status).toBe(200)
    expect(claimAnonymousAudits).not.toHaveBeenCalled()
    expect(await response.json()).toEqual({
      user: { id: 'user-1', email: 'person@example.com' },
    })
  })

  it('claims only through authenticated POST and returns refreshed user state', async () => {
    const response = await POST()
    expect(response.status).toBe(200)
    expect(claimAnonymousAudits).toHaveBeenCalledOnce()
    expect(claimAnonymousAudits).toHaveBeenCalledWith('user-1')
    expect(await response.json()).toEqual({
      claimedCount: 2,
      user: { id: 'user-1', email: 'person@example.com' },
    })
  })

  it('rejects an unauthenticated claim without mutating audits', async () => {
    getSession.mockResolvedValue(null)
    const response = await POST()
    expect(response.status).toBe(401)
    expect(claimAnonymousAudits).not.toHaveBeenCalled()
  })

  it('returns a clear Product limit when a claim would add another Product', async () => {
    claimAnonymousAudits.mockRejectedValue(new ProductLimitReached(1))

    const response = await POST()

    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'PROJECT_LIMIT' })
  })
})
