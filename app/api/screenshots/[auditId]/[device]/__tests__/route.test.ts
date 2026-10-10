import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ audit: vi.fn(), session: vi.fn(), access: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: mocks.audit } } }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser: mocks.session }))
vi.mock('@/lib/audit/access', () => ({ resolveAuditAccess: mocks.access }))
vi.mock('@/lib/storage/screenshots', () => ({ readScreenshot: mocks.read }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/audit/usage', () => ({ readAnonAuditIdsFromStore: () => [] }))
import { GET } from '../route'
const read = (query = '', device = 'desktop') => GET(new NextRequest(`http://localhost/api/screenshots/private-audit/${device}${query}`), { params: Promise.resolve({ auditId: 'private-audit', device }) })

describe('private screenshot delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.audit.mockResolvedValue({ id: 'private-audit', userId: 'owner', isPublic: false })
    mocks.session.mockResolvedValue({ user: { id: 'owner' } })
    mocks.access.mockResolvedValue('owner')
    mocks.read.mockResolvedValue(Buffer.from('captured-image-bytes'))
  })
  it('streams stored bytes with no reusable browser cache', async () => {
    const response = await read('?page=p0')
    expect(response.status).toBe(200)
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('vary')).toBe('Cookie')
    expect(await response.text()).toBe('captured-image-bytes')
    expect(mocks.read).toHaveBeenCalledWith('private-audit', 'desktop', 'p0')
  })
  it('refuses another owner or anonymous viewer before touching storage', async () => {
    for (const session of [null, { user: { id: 'stranger' } }]) {
      mocks.session.mockResolvedValue(session); mocks.access.mockResolvedValue('denied')
      expect((await read()).status).toBe(403)
    }
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('refuses invalid page keys and devices before reading bytes', async () => {
    expect((await read('?page=../private')).status).toBe(400)
    expect((await read('', 'other')).status).toBe(400)
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('does not return fabricated evidence for a missing object', async () => {
    mocks.read.mockResolvedValue(null)
    expect((await read('?page=p0')).status).toBe(404)
  })
})
