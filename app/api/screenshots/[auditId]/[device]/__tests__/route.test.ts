import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
const mocks = vi.hoisted(() => ({ audit: vi.fn(), session: vi.fn(), claimIds: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { audit: { findUnique: mocks.audit } } }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser: mocks.session }))
vi.mock('@/lib/storage/screenshots', () => ({ readScreenshot: mocks.read }))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('@/lib/audit/usage', () => ({ readAnonAuditIdsFromStore: mocks.claimIds }))
import { GET } from '../route'
const read = (query = '', device = 'desktop') => GET(new NextRequest(`http://localhost/api/screenshots/private-audit/${device}${query}`), { params: Promise.resolve({ auditId: 'private-audit', device }) })

describe('private screenshot delivery', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.audit.mockResolvedValue({ id: 'private-audit', userId: 'owner', isPublic: false })
    mocks.session.mockResolvedValue({ user: { id: 'owner' } })
    mocks.claimIds.mockReturnValue([])
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
      mocks.session.mockResolvedValue(session)
      const denied = await read()
      expect(denied.status).toBe(404)
      const { requestId: deniedRequest, ...deniedBody } = await denied.json()
      mocks.audit.mockResolvedValueOnce(null)
      const missing = await read()
      expect(missing.status).toBe(denied.status)
      const { requestId: missingRequest, ...missingBody } = await missing.json()
      expect(missingBody).toEqual(deniedBody)
      expect(deniedRequest).toEqual(expect.any(String))
      expect(missingRequest).toEqual(expect.any(String))
    }
    expect(mocks.read).not.toHaveBeenCalled()
  })
  it('keeps initial captures private before signup while their creator can inspect them', async () => {
    mocks.audit.mockResolvedValue({ id: 'private-audit', userId: null, isPublic: false })
    for (const session of [null, { user: { id: 'stranger' } }]) {
      mocks.session.mockResolvedValue(session)
      expect((await read()).status).toBe(404)
    }
    expect(mocks.read).not.toHaveBeenCalled()
    mocks.session.mockResolvedValue(null)
    mocks.claimIds.mockReturnValue(['private-audit'])
    expect((await read()).status).toBe(200)
    expect(mocks.read).toHaveBeenCalledWith('private-audit', 'desktop', null)
  })
  it('preserves previously public screenshot access', async () => {
    mocks.audit.mockResolvedValue({ id: 'private-audit', userId: null, isPublic: true })
    mocks.session.mockResolvedValue(null)
    expect((await read()).status).toBe(200)
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
