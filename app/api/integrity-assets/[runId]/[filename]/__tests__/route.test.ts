import { beforeEach, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { newPathArtifactNamespace, outcomeArtifactNamespace } from '@/lib/integrity/artifact-namespace'
const mocks = vi.hoisted(() => ({ session: vi.fn(), run: vi.fn(), installation: vi.fn(), shop: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { runRequest: { findFirst: mocks.run }, shopifyShop: { findFirst: mocks.installation } } }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser: mocks.session }))
vi.mock('@/lib/shopify/session', () => ({ shopDomainFromRequest: mocks.shop }))
vi.mock('@/lib/integrity/storage', () => ({ readIntegrityArtifact: mocks.read }))
import { GET } from '../route'
const get = (runId = 'outcome-run1-checkout', filename = 'attempt-2-failure.png') => GET(new NextRequest(`http://localhost/api/integrity-assets/${runId}/${filename}`), { params: Promise.resolve({ runId, filename }) })
const outcome = { projectId: 'site1', auditId: 'audit1', audit: { projectId: 'site1' } }
const installation = { id: 'shop1', shopDomain: 'one.myshopify.com', projectId: 'site1', authorizationVersion: 1 }
const ownedSite = { userId: 'owner', deletedAt: null,
  user: { lifecycleStatus: 'ACTIVE', sessions: { some: { id: 'session1', expiresAt: { gt: expect.any(Date) } } } } }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.session.mockResolvedValue({ user: { id: 'owner' }, session: { id: 'session1' } })
  mocks.run.mockResolvedValue(outcome)
  mocks.shop.mockReturnValue(null)
  mocks.read.mockResolvedValue(Buffer.from('stored-bytes'))
})
it('authorizes the durable Outcome request owner before reading an artifact', async () => {
  const response = await get()
  expect(response.status).toBe(200); expect(await response.text()).toBe('stored-bytes')
  expect(response.headers.get('cache-control')).toBe('private, no-store')
  expect(mocks.run).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { id: 'run1', project: ownedSite } }))
  expect(mocks.run).toHaveBeenNthCalledWith(2, { where: { id: 'run1', projectId: 'site1', auditId: 'audit1',
    audit: { projectId: 'site1' }, project: ownedSite }, select: { id: true } })
})
it('denies an anonymous viewer or a different owner without touching storage', async () => {
  mocks.session.mockResolvedValue(null); expect((await get()).status).toBe(403)
  mocks.session.mockResolvedValue({ user: { id: 'stranger' }, session: { id: 'other-session' } })
  mocks.run.mockResolvedValue(null); expect((await get()).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
})
it.each(['historical', 'generation', 'bound'])('authorizes the full admitted UUID with %s evidence', async format => {
  const id = 'a733f8db-9104-4c73-bb50-6d654bd5da6e'
  mocks.run.mockImplementation(async ({ where }) => where.id === id && where.project.userId === 'owner' ? outcome : null)
  const namespace = format === 'bound'
    ? outcomeArtifactNamespace({ runId: id, outcomeId: 'outcome-1', bindingKey: 'checkout-browser-v1' }, 3)
    : 'outcome-' + id + '-checkout-browser-v1' + (format === 'generation' ? '-g3' : '')
  expect((await get(namespace)).status).toBe(200)
  expect(mocks.run).toHaveBeenCalledWith(expect.objectContaining({ where: { id, project: ownedSite } }))
  expect(mocks.read).toHaveBeenCalledWith(namespace, 'attempt-2-failure.png', { signal: expect.any(AbortSignal) })
  mocks.read.mockClear()
  mocks.session.mockResolvedValue({ user: { id: 'stranger' }, session: { id: 'other-session' } })
  expect((await get(namespace)).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
})
it('permits only the exact verified active Shopify shop or linked Site owner', async () => {
  mocks.session.mockResolvedValue(null)
  mocks.installation.mockImplementation(async ({ where }) => where.OR?.some((rule: { shopDomain?: string }) =>
    rule.shopDomain === installation.shopDomain) || where.shopDomain === installation.shopDomain ? installation : null)
  mocks.shop.mockReturnValue('two.myshopify.com'); expect((await get('path-path1-123')).status).toBe(403)
  expect(mocks.read).not.toHaveBeenCalled()
  mocks.shop.mockReturnValue('one.myshopify.com'); expect((await get('path-path1-123')).status).toBe(200)
  expect(mocks.installation).toHaveBeenLastCalledWith({ where: { id: installation.id, paths: { some: { id: 'path1' } },
    uninstalledAt: null, authorizationVersion: installation.authorizationVersion, shopDomain: installation.shopDomain,
  }, select: { id: true } })
})
it.each(['path-path1-123', newPathArtifactNamespace('path1')])('permits a linked Site owner to read historical and uniquely named Shopify evidence: %s', async namespace => {
  mocks.installation.mockResolvedValue(installation)
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
