import { beforeEach, expect, it, vi } from 'vitest'
const { requireSiteOwner, getSession, loadReportedBuilder, reportBuilder } = vi.hoisted(() => ({
  requireSiteOwner: vi.fn(), getSession: vi.fn(), loadReportedBuilder: vi.fn(), reportBuilder: vi.fn(),
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner }))
vi.mock('@/lib/sites/application/builder-report', async importOriginal => ({ ...await importOriginal<object>(), loadReportedBuilder, reportBuilder }))
import { GET, POST } from '../route'

const context = { params: Promise.resolve({ siteId: 'site' }) }
const post = (body: string) => POST(new Request('https://example.com/', { method: 'POST', body }), context)

beforeEach(() => {
  vi.clearAllMocks()
  getSession.mockResolvedValue({ user: { id: 'owner' } })
  requireSiteOwner.mockResolvedValue({ ok: true, projectId: 'project' })
  loadReportedBuilder.mockResolvedValue(null)
  reportBuilder.mockImplementation(async ({ tool }: { tool: string }) => tool)
})

it('requires a signed-in owner before reading or recording anything', async () => {
  getSession.mockResolvedValue(null)
  expect((await GET(new Request('https://example.com/'), context)).status).toBe(401)
  getSession.mockResolvedValue({ user: { id: 'stranger' } })
  requireSiteOwner.mockResolvedValue({ ok: false, status: 404, message: 'Site not found' })
  expect((await post('{"tool":"lovable"}')).status).toBe(404)
  expect(loadReportedBuilder).not.toHaveBeenCalled()
  expect(reportBuilder).not.toHaveBeenCalled()
})

it('reads the saved answer and records only listed tools for the resolved Project', async () => {
  const read = await GET(new Request('https://example.com/'), context)
  expect(await read.json()).toEqual({ tool: null })
  expect(read.headers.get('Cache-Control')).toBe('private, no-store')
  expect((await post('{"tool":"not-a-tool"}')).status).toBe(400)
  expect((await post('{"tool":"lovable","extra":1}')).status).toBe(400)
  expect((await post('not json')).status).toBe(400)
  const saved = await post('{"tool":"claude-code"}')
  expect(saved.status).toBe(200)
  expect(await saved.json()).toEqual({ tool: 'claude-code' })
  expect(reportBuilder).toHaveBeenCalledWith({ projectId: 'project', userId: 'owner', tool: 'claude-code' })
})
