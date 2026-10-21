import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({ owner: vi.fn(), history: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner: mocks.owner }))
vi.mock('@/lib/uptime/queries', async importOriginal => ({ ...await importOriginal<typeof import('@/lib/uptime/queries')>(), loadUptimeHistory: mocks.history }))
import { GET } from '../route'
import { InvalidUptimeCursorError } from '@/lib/uptime/queries'
const context = { params: Promise.resolve({ siteId: 'alias' }) }
const request = (query = '') => new Request(`http://localhost/api/sites/alias/uptime${query}`)
beforeEach(() => { vi.clearAllMocks(); mocks.owner.mockResolvedValue({ ok: true, projectId: 'owned-project', decision: { site: { siteId: 'owned-project' } } }); mocks.history.mockResolvedValue({ window: '24h', probes: [], nextCursor: null }) })
describe('private Uptime history', () => {
  it.each([403, 404])('denies access before reading evidence (%s)', async status => {
    mocks.owner.mockResolvedValue({ ok: false, status, message: 'Site not found' })
    expect((await GET(request(), context)).status).toBe(status)
    expect(mocks.history).not.toHaveBeenCalled()
  })
  it('uses the authorized project and canonical identity for history', async () => {
    const response = await GET(request('?window=7d&cursor=probe_1'), context)
    expect(mocks.history).toHaveBeenCalledWith('owned-project', '7d', 'probe_1')
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
})
