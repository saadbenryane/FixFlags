import { beforeEach, expect, it, vi } from 'vitest'
import { siteViewFixture } from '@/lib/sites/__tests__/site-view-fixture'
import { SITE_SUMMARY_OWNER_HEADER, SITE_SUMMARY_READ_AT_HEADER, siteSummariesSchema } from '@/lib/sites/summary-contract'

const mocks = vi.hoisted(() => ({ session: vi.fn(), sites: vi.fn() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.session } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/sites/application/list-sites', () => ({ loadSiteSummaries: mocks.sites }))
import { GET } from '../route'

beforeEach(() => vi.resetAllMocks())
it('requires a session before reading account summaries', async () => {
  mocks.session.mockResolvedValue(null)
  expect((await GET()).status).toBe(401)
  expect(mocks.sites).not.toHaveBeenCalled()
})
it('labels uncached summary responses with the exact authenticated account', async () => {
  const sites = [{ id: 'fixture-site', name: 'Example', hostname: 'example.com',
    presentation: siteViewFixture().presentation, lastUsefulChangeAt: '2026-11-03T00:00:00Z' }]
  mocks.sites.mockResolvedValue(sites)
  for (const id of ['account-a', 'account-b']) {
    mocks.session.mockResolvedValue({ user: { id } })
    const response = await GET()
    expect(response.headers.get('Cache-Control')).toBe('private, no-store')
    expect(response.headers.get(SITE_SUMMARY_OWNER_HEADER)).toBe(id)
    expect(Number(response.headers.get(SITE_SUMMARY_READ_AT_HEADER))).toBeGreaterThan(0)
    expect(mocks.sites).toHaveBeenLastCalledWith(id)
    expect(siteSummariesSchema.parse(await response.json())).toEqual(sites)
  }
})
