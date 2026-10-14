import { beforeEach, expect, it, vi } from 'vitest'
const { requireSiteOwner, readSavedScanAccess, saveScanAccess } = vi.hoisted(() => ({ requireSiteOwner: vi.fn(), readSavedScanAccess: vi.fn(), saveScanAccess: vi.fn() }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteOwner }))
vi.mock('@/lib/sites/application/scan-access-commands', () => ({ readSavedScanAccess, saveScanAccess }))
import { GET, PUT, DELETE } from '../route'
const context = { params: Promise.resolve({ siteId: 'site' }) }
beforeEach(() => {
  vi.clearAllMocks()
  requireSiteOwner.mockResolvedValue({ ok: true, projectId: 'project', decision: { site: { userId: 'owner' } } })
  readSavedScanAccess.mockResolvedValue({ configured: false, summary: null })
  saveScanAccess.mockResolvedValue({ configured: false, summary: null })
})
it.each([401, 403, 404])('refuses private access with %s before reaching credentials', async status => {
  requireSiteOwner.mockResolvedValue({ ok: false, status, message: status === 404 ? 'Site not found' : 'Sign in required' })
  for (const handler of [GET, PUT, DELETE]) {
    expect((await handler(new Request('https://example.com/'), context)).status).toBe(status)
  }
  expect(readSavedScanAccess).not.toHaveBeenCalled(); expect(saveScanAccess).not.toHaveBeenCalled()
})
it('uses the resolved private Project and owner, independently of the public Site id', async () => {
  expect((await GET(new Request('https://example.com/'), context)).status).toBe(200)
  expect(readSavedScanAccess).toHaveBeenCalledWith('project', 'owner')
})
it('requires an explicit replacement or removal, preserving omitted credentials', async () => {
  expect((await PUT(new Request('https://example.com/', { method: 'PUT', body: '{}' }), context)).status).toBe(400)
  expect(saveScanAccess).not.toHaveBeenCalled()
  expect((await PUT(new Request('https://example.com/', { method: 'PUT', body: '{"scanAccess":null}' }), context)).status).toBe(200)
  expect(saveScanAccess).toHaveBeenCalledWith('project', 'owner', null)
})
