import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { newPathArtifactNamespace } from '@/lib/integrity/artifact-namespace'
const mocks = vi.hoisted(() => ({ session: vi.fn(), run: vi.fn(), path: vi.fn(), shop: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { runRequest: { findFirst: mocks.run }, revenuePath: { findFirst: mocks.path } } }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser: mocks.session }))
vi.mock('@/lib/shopify/session', () => ({ shopDomainFromRequest: mocks.shop }))
vi.mock('@/lib/integrity/storage', () => ({ readIntegrityArtifact: mocks.read }))
import { GET } from '../route'
const get = (runId = 'outcome-run1-checkout', filename = 'attempt-2-failure.png') => GET(new NextRequest(`http://localhost/api/integrity-assets/${runId}/${filename}`), { params: Promise.resolve({ runId, filename }) })
beforeEach(() => {
  vi.resetAllMocks(); mocks.session.mockResolvedValue({ user: { id: 'owner' } }); mocks.run.mockResolvedValue({ id: 'run1' }); mocks.read.mockResolvedValue(Buffer.from('stored-bytes'))
})
it('authorizes the durable Outcome request owner before reading an artifact', async () => {
  const response = await get()
  expect(response.status).toBe(200); expect(await response.text()).toBe('stored-bytes')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.run).toHaveBeenCalledWith({ where: { id: 'run1', project: { userId: 'owner' } }, select: { id: true } })
})
it('denies an anonymous viewer or a different owner without touching storage', async () => {
  mocks.session.mockResolvedValue(null); expect((await get()).status).toBe(403)
  mocks.session.mockResolvedValue({ user: { id: 'stranger' } }); mocks.run.mockResolvedValue(null); expect((await get()).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
})
it.each(['checkout-browser-v1', 'checkout-browser-v1-g3'])('authorizes the full admitted UUID with %s evidence', async binding => {
  const id = 'a733f8db-9104-4c73-bb50-6d654bd5da6e'
  mocks.run.mockImplementation(async ({ where }) => where.id === id && where.project.userId === 'owner' ? { id } : null)
  const namespace = 'outcome-' + id + '-' + binding
  expect((await get(namespace)).status).toBe(200)
  expect(mocks.run).toHaveBeenCalledWith({ where: { id, project: { userId: 'owner' } }, select: { id: true } })
  expect(mocks.read).toHaveBeenCalledWith(namespace, 'attempt-2-failure.png')
  mocks.read.mockClear()
  mocks.session.mockResolvedValue({ user: { id: 'stranger' } })
  expect((await get(namespace)).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('permits only the exact verified active Shopify shop or linked Site owner', async () => {
  mocks.session.mockResolvedValue(null); mocks.path.mockResolvedValue({ shop: { shopDomain: 'one.myshopify.com', project: { userId: 'owner' } } })
  mocks.shop.mockReturnValue('two.myshopify.com'); expect((await get('path-path1-123')).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
  mocks.shop.mockReturnValue('one.myshopify.com'); expect((await get('path-path1-123')).status).toBe(200)
  expect(mocks.path).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'path1', shop: { uninstalledAt: null } } }))
})
it.each(['path-path1-123', newPathArtifactNamespace('path1')])('permits a linked Site owner to read historical and uniquely named Shopify evidence: %s', async namespace => {
  mocks.path.mockResolvedValue({ shop: { shopDomain: 'one.myshopify.com', project: { userId: 'owner' } } })
  expect((await get(namespace)).status).toBe(200)
})
it('rejects unbound namespaces and traversal', async () => {
  expect((await get('unbound')).status).toBe(403)
  expect((await get('../other')).status).toBe(404)
  expect((await get('outcome-run1-checkout', '../secret.png')).status).toBe(404)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('does not replace a missing capture with manufactured bytes', async () => {
  mocks.read.mockResolvedValue(null); expect((await get()).status).toBe(404)
})
