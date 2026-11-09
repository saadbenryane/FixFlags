import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ owner: vi.fn(), history: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.owner }))
vi.mock('@/lib/uptime/queries', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/uptime/queries')>(), loadUptimeHistory: mocks.history }))
import { GET } from '../route'
import { InvalidUptimeCursorError } from '@/lib/uptime/queries'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'
const context = { params: Promise.resolve({ siteId: 'alias' }) }
const request = (query = '') => new Request(`http://localhost/api/sites/alias/uptime${query}`)
const site = { siteId: 'owned-project', kind: 'project', projectId: 'owned-project', userId: 'owner' }
beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue({ ok: true, projectId: 'owned-project', decision: { site } }); mocks.history.mockResolvedValue({ window: '24h', probes: [], nextCursor: null }) })
describe('private Uptime history', () => {
  it.each([403, 404])('denies access before reading evidence (%s)', async status => {
    mocks.owner.mockResolvedValue({ ok: false, status, message: 'Site not found' })
    expect((await GET(request(), context)).status).toBe(status)
    expect(mocks.history).not.toHaveBeenCalled()
  })
  it('uses the authorized project and canonical identity for history', async () => {
    const cursor = 'u1.probe_1.' + 'a'.repeat(43)
    const response = await GET(request('?window=7d&cursor=' + cursor), context)
    expect(mocks.history).toHaveBeenCalledWith(site, '7d', cursor)
    expect(await response.json()).toMatchObject({ siteId: 'owned-project' })
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  })
  it.each(['?window=1y', '?cursor=invalid%20cursor', '?cursor=' ])('rejects unbounded or invalid query %s', async query => {
    expect((await GET(request(query), context)).status).toBe(400)
    expect(mocks.history).not.toHaveBeenCalled()
  })
  it('rejects a cursor outside the authorized monitor history', async () => {
    mocks.history.mockRejectedValue(new InvalidUptimeCursorError())
    expect((await GET(request('?cursor=foreign-probe'), context)).status).toBe(400)
  })
  it('withholds a read when Site authority changes after request admission', async () => {
    mocks.history.mockRejectedValue(new SiteRunRefusal('Site not found', 404))
    const response = await GET(request(), context)
    expect(response.status).toBe(404)
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(await response.json()).not.toHaveProperty('probes')
  })
})
