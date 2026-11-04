import { beforeEach, expect, it, vi } from 'vitest'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'

const mocks = vi.hoisted(() => ({ access: vi.fn(), home: vi.fn(), owner: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.access }))
vi.mock('@/lib/sites/application/queries', () => ({ loadSiteHome: mocks.home }))
vi.mock('@/lib/db', () => ({ prisma: { project: { findFirst: mocks.owner } } }))
vi.mock('@/lib/sites/application/settings-commands', () => ({ removeSite: vi.fn(), siteRemovalSchema: { safeParse: vi.fn() } }))
import { GET } from '../route'

const context = { params: Promise.resolve({ siteId: 'request-alias' }) }
const request = (query = '?scope=identity') => new Request(`http://localhost/api/sites/request-alias${query}`)
beforeEach(() => {
  vi.clearAllMocks()
  const site = { ...siteViewFixture().site, url: 'https://www.example.com/private/path?token=excluded' }
  mocks.access.mockResolvedValue({ ok: true, decision: { site, role: 'owner', authenticated: true } })
  mocks.owner.mockResolvedValue({ id: site.projectId })
  mocks.home.mockResolvedValue({ marker: 'full-view' })
})

it('returns only authorized identity without loading the Site board or exposing its URL, evidence, or settings', async () => {
  const response = await GET(request(), context)
  expect(await response.json()).toEqual({ siteId: 'request-alias', hostname: 'example.com' })
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(mocks.home).not.toHaveBeenCalled()
  expect(mocks.owner).toHaveBeenCalledTimes(2)
})

it('retains signed provisional access without requiring an owned project or creating one', async () => {
  mocks.access.mockResolvedValue({ ok: true, decision: { role: 'provisional_session', site: {
    ...siteViewFixture().site, kind: 'provisional', projectId: null, userId: null, url: 'https://preview.example/path',
  } } })
  const response = await GET(request(), context)
  expect(await response.json()).toEqual({ siteId: 'request-alias', hostname: 'preview.example' })
  expect(mocks.owner).not.toHaveBeenCalled()
  expect(mocks.home).not.toHaveBeenCalled()
})

it('withholds identity for an inaccessible Site without exposing whether it exists', async () => {
  mocks.access.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
  const response = await GET(request(), context)
  expect(response.status).toBe(404)
  expect(await response.json()).not.toHaveProperty('hostname')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(mocks.owner).not.toHaveBeenCalled()
  expect(mocks.home).not.toHaveBeenCalled()
})

it.each(['before', 'after'])('rechecks admitted owner authority %s reading identity', async stage => {
  if (stage === 'before') mocks.owner.mockResolvedValue(null)
  else mocks.owner.mockResolvedValueOnce({ id: 'project' }).mockResolvedValueOnce(null)
  const response = await GET(request(), context)
  expect(response.status).toBe(404)
  expect(await response.json()).not.toHaveProperty('hostname')
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
})

it.each(['', '?scope=settings'])('preserves the existing composed view read: %s', async query => {
  const response = await GET(request(query), context)
  expect(await response.json()).toEqual({ marker: 'full-view' })
  expect(mocks.home).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ readScope: query ? 'settings' : 'overview', ownerEvidence: true }))
})
