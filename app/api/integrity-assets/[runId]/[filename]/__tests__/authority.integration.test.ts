import { createHmac, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { newPathArtifactNamespace, outcomeArtifactNamespace } from '@/lib/integrity/artifact-namespace'
import { GET } from '../route'

const boundary = vi.hoisted(() => ({ viewer: vi.fn(), read: vi.fn() }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser: boundary.viewer }))
vi.mock('@/lib/integrity/storage', () => ({ readIntegrityArtifact: boundary.read }))

const filename = 'attempt-1-failure.png'
const bytes = Buffer.from('private checkout capture')
function get(runId: string, token?: string) {
  return GET(new NextRequest(`http://localhost/api/integrity-assets/${runId}/${filename}`, {
    headers: token ? { authorization: 'Bearer ' + token } : {},
  }), { params: Promise.resolve({ runId, filename }) })
}

async function viewerFixture(host = 'example.com') {
  const user = await prisma.user.create({ data: { email: randomUUID() + '@integrity-test.example' } })
  const session = await prisma.session.create({ data: { id: randomUUID(), userId: user.id, token: randomUUID(),
    expiresAt: new Date(Date.now() + 60_000) } })
  const project = await prisma.project.create({ data: { userId: user.id, canonicalHost: host,
    url: 'https://' + host + '/', name: 'Private captures' } })
  return { user, session, project }
}

describe.skipIf(process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED !== 'true')('private integrity media publication', () => {
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  beforeEach(() => {
    vi.resetAllMocks()
    boundary.read.mockResolvedValue(bytes)
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    await prisma.shopifyShop.deleteMany({ where: { shopDomain: { startsWith: 'artifact-test-' } } })
    const where = { email: { endsWith: '@integrity-test.example' } }
    await prisma.audit.deleteMany({ where: { user: where } })
    await prisma.user.deleteMany({ where })
  })
  afterAll(() => prisma.$disconnect())

  it.each(['transfer', 'removal', 'suspension', 'revocation', 'expiry', 'different Audit'] as const)(
    'withholds an Outcome capture after %s during storage retrieval', async change => {
      const viewer = await viewerFixture()
      const replacement = await viewerFixture('replacement.example.com')
      const audit = await prisma.audit.create({ data: { userId: viewer.user.id, projectId: viewer.project.id,
        status: 'COMPLETED', url: viewer.project.url } })
      const run = await prisma.runRequest.create({ data: { projectId: viewer.project.id, auditId: audit.id, status: 'COMPLETED',
        source: 'WATCH', idempotencyKey: randomUUID() } })
      const namespace = outcomeArtifactNamespace({ runId: run.id, outcomeId: 'checkout', bindingKey: 'browser' }, 1)
      boundary.viewer.mockResolvedValue(viewer)
      const initial = await get(namespace)
      expect(initial.status).toBe(200)
      expect(await initial.text()).toBe(bytes.toString())
      boundary.read.mockClear().mockImplementationOnce(async () => {
        if (change === 'transfer') await prisma.project.update({ where: { id: viewer.project.id }, data: { userId: replacement.user.id } })
        if (change === 'removal') await prisma.project.update({ where: { id: viewer.project.id }, data: { deletedAt: new Date() } })
        if (change === 'suspension') await prisma.user.update({ where: { id: viewer.user.id }, data: { lifecycleStatus: 'SUSPENDED' } })
        if (change === 'revocation') await prisma.session.delete({ where: { id: viewer.session.id } })
        if (change === 'expiry') await prisma.session.update({ where: { id: viewer.session.id }, data: { expiresAt: new Date(0) } })
        if (change === 'different Audit') {
          const foreign = await prisma.audit.create({ data: { userId: replacement.user.id, projectId: replacement.project.id,
            status: 'COMPLETED', url: replacement.project.url } })
          await prisma.runRequest.update({ where: { id: run.id }, data: { auditId: foreign.id } })
        }
        return bytes
      })
      const rejected = await get(namespace)
      expect(boundary.read).toHaveBeenCalledOnce()
      expect(rejected.status).toBe(403)
      expect(await rejected.text()).not.toContain(bytes.toString())
      boundary.read.mockClear()
      expect((await get(namespace)).status).toBe(403)
      expect(boundary.read).not.toHaveBeenCalled()
      if (change === 'transfer') {
        boundary.viewer.mockResolvedValue(replacement)
        expect((await get(namespace)).status).toBe(200)
      }
    },
  )

  it.each(['unlink', 'relink', 'reinstall', 'uninstall', 'token expiry'] as const)(
    'withholds Shopify path media after %s during storage retrieval', async change => {
      const viewer = await viewerFixture()
      const shop = await prisma.shopifyShop.create({ data: {
        shopDomain: 'artifact-test-' + randomUUID() + '.myshopify.com', encryptedAccessToken: 'fixture',
        projectId: viewer.project.id,
        paths: { create: { storefrontUrl: viewer.project.url, label: 'Checkout path' } },
      }, include: { paths: true } })
      const namespace = newPathArtifactNamespace(shop.paths[0].id)
      const viaOwner = change === 'unlink' || change === 'relink'
      const expiresAt = Math.floor(Date.now() / 1000) + 60
      vi.stubEnv('FIXFLAGS_SHOPIFY_FIXTURE', '0')
      vi.stubEnv('SHOPIFY_API_KEY', 'fixture-key')
      vi.stubEnv('SHOPIFY_API_SECRET', 'fixture-secret')
      const body = Buffer.from(JSON.stringify({ aud: 'fixture-key', sub: 'fixture-merchant',
        iss: 'https://' + shop.shopDomain + '/admin', dest: 'https://' + shop.shopDomain, exp: expiresAt })).toString('base64url')
      const signed = Buffer.from('{"alg":"HS256","typ":"JWT"}').toString('base64url') + '.' + body
      const token = viaOwner ? undefined : signed + '.' + createHmac('sha256', 'fixture-secret').update(signed).digest('base64url')
      boundary.viewer.mockResolvedValue(viaOwner ? viewer : null)
      const initial = await get(namespace, token)
      expect(initial.status).toBe(200)
      expect(await initial.text()).toBe(bytes.toString())
      boundary.read.mockClear().mockImplementationOnce(async () => {
        if (change === 'unlink') await prisma.shopifyShop.update({ where: { id: shop.id }, data: { projectId: null } })
        if (change === 'relink') {
          const destination = await prisma.project.create({ data: { userId: viewer.user.id, canonicalHost: 'another.example.com',
            url: 'https://another.example.com/', name: 'Another owned Site' } })
          await prisma.shopifyShop.update({ where: { id: shop.id }, data: { projectId: destination.id } })
        }
        if (change === 'uninstall') await prisma.shopifyShop.update({ where: { id: shop.id },
          data: { uninstalledAt: new Date(), authorizationVersion: { increment: 1 } } })
        if (change === 'reinstall') await prisma.shopifyShop.update({ where: { id: shop.id },
          data: { uninstalledAt: null, authorizationVersion: { increment: 2 } } })
        if (change === 'token expiry') vi.spyOn(Date, 'now').mockReturnValue(expiresAt * 1000)
        return bytes
      })
      const rejected = await get(namespace, token)
      expect(boundary.read).toHaveBeenCalledOnce()
      expect(rejected.status).toBe(403)
      expect(await rejected.text()).not.toContain(bytes.toString())
    },
  )
})
