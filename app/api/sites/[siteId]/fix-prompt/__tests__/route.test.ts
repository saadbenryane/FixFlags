import { beforeEach, describe, expect, it, vi } from 'vitest'
import { POST } from '../route'
const mocks = vi.hoisted(() => ({ access: vi.fn(), bundle: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.access }))
vi.mock('@/lib/sites/application/fix-bundle', () => ({ loadSiteFixBundle: mocks.bundle }))
const context = { params: Promise.resolve({ siteId: 'visitor-link' }) }
const request = (body: unknown) => new Request('https://fixflags.com/api/sites/visitor-link/fix-prompt', { method: 'POST', body: JSON.stringify(body) })
beforeEach(() => {
  vi.clearAllMocks()
  mocks.access.mockResolvedValue({ ok: true, decision: { site: { siteId: 'resolved-owner-site' } } })
  mocks.bundle.mockResolvedValue({ prompt: 'Canonical task', tasks: [{ sourceFlagId: 'f', promptHash: 'a'.repeat(64) }] })
})
describe('repair bundle authorization', () => {
  it('validates explicit selections before preparing owner tasks', async () => {
    expect((await POST(request({ flagIds: ['one', 'two'] }), context)).status).toBe(200)
    expect(mocks.bundle).toHaveBeenCalledWith({ siteId: 'resolved-owner-site' }, undefined, ['one', 'two'])
    mocks.bundle.mockClear()
    for (const flagIds of [[], ['one', 'one'], Array.from({ length: 101 }, (_, i) => String(i))])
      expect((await POST(request({ flagIds }), context)).status).toBe(400)
    expect(mocks.bundle).not.toHaveBeenCalled()
  })
  it.each([401,403,404])('does not load tasks when ownership is refused (%s)', async status => {
    mocks.access.mockResolvedValue({ ok: false, status, message: 'Site access refused' })
    const response = await POST(request({}), context)
    expect(response.status).toBe(status)
    expect(mocks.bundle).not.toHaveBeenCalled()
  })
  it('uses the resolved owned Site, validates scope, and prohibits caching', async () => {
    const response = await POST(request({ area: 'performance' }), context)
    expect(response.status).toBe(200)
    expect(mocks.bundle).toHaveBeenCalledWith({ siteId: 'resolved-owner-site' }, 'performance')
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect((await response.json()).tasks).toHaveLength(1)
    expect((await POST(request({ area: 'unknown' }), context)).status).toBe(400)
    expect((await POST(request({ siteId: 'other-owner' }), context)).status).toBe(400)
  })
})
