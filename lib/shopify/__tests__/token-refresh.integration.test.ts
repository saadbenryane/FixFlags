import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret } from '@/lib/security/crypto'
import { getValidOfflineToken, persistTokenSet } from '../tokens'
import { uninstallShop } from '../uninstall'

vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip

run('Shopify offline-token ownership in disposable PostgreSQL', () => {
  const domains: string[] = []
  beforeAll(() => {
    const database = new URL(process.env.DATABASE_URL ?? '')
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
  })
  afterEach(() => vi.unstubAllGlobals())
  afterAll(async () => {
    try { if (domains.length) await prisma.shopifyShop.deleteMany({ where: { shopDomain: { in: domains } } }) }
    finally { await prisma.$disconnect() }
  })

  async function expiringShop() {
    const shopDomain = 'refresh-' + randomUUID() + '.myshopify.com'
    domains.push(shopDomain)
    return prisma.shopifyShop.create({ data: { shopDomain, encryptedAccessToken: encryptSecret('original-access'),
      encryptedRefreshToken: encryptSecret('original-refresh'), tokenExpiresAt: new Date(0), refreshExpiresAt: new Date(Date.now() + 3_600_000) } })
  }
  function heldProvider(shopDomain: string, status = 200) {
    const releases: Array<() => void> = []
    const transport = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(String(input)).toBe('https://' + shopDomain + '/admin/oauth/access_token')
      expect(init?.method).toBe('POST')
      const body = new URLSearchParams(String(init?.body))
      expect(body.get('refresh_token')).toBe('original-refresh')
      const index = releases.length
      return new Promise<Response>(resolve => { releases.push(() => resolve(Response.json({ access_token: 'refreshed-access-' + index,
        refresh_token: 'refreshed-refresh-' + index, expires_in: 3600, refresh_token_expires_in: 7200 }, { status }))) })
    })
    vi.stubGlobal('fetch', transport)
    return { transport, releases }
  }

  it.each([{ transition: 'uninstall', status: 200 }, { transition: 'reinstall', status: 200 },
    { transition: 'uninstall', status: 401 }, { transition: 'reinstall', status: 401 }])('refuses a $status refresh admitted before $transition without restoring or replacing its credentials', async ({ transition, status }) => {
    const shop = await expiringShop(), provider = heldProvider(shop.shopDomain, status)
    const pending = getValidOfflineToken(shop.shopDomain)
    void pending.catch(() => undefined)
    try {
      await vi.waitFor(() => expect(provider.transport).toHaveBeenCalledOnce())
      await uninstallShop(shop.shopDomain)
      if (transition === 'reinstall') await persistTokenSet(shop.shopDomain, { accessToken: 'new-install-access', refreshToken: 'new-install-refresh',
        scope: 'read_products', expiresAt: new Date(Date.now() + 3_600_000), refreshExpiresAt: null })
      provider.releases[0]()
      await expect(pending).rejects.toThrow(/connection changed/i)
      const saved = await prisma.shopifyShop.findUniqueOrThrow({ where: { id: shop.id } })
      expect(saved.uninstalledAt === null).toBe(transition === 'reinstall')
      expect(saved.encryptedAccessToken ? decryptSecret(saved.encryptedAccessToken) : '').toBe(transition === 'reinstall' ? 'new-install-access' : '')
      expect(saved.encryptedRefreshToken ? decryptSecret(saved.encryptedRefreshToken) : null).toBe(transition === 'reinstall' ? 'new-install-refresh' : null)
    } finally { provider.releases.forEach(release => release()); await pending.catch(() => undefined) }
  })

  it('admits only one writer when two refreshes observed the same credentials', async () => {
    const shop = await expiringShop(), provider = heldProvider(shop.shopDomain)
    const first = getValidOfflineToken(shop.shopDomain), second = getValidOfflineToken(shop.shopDomain)
    const results = Promise.allSettled([first, second])
    try {
      await vi.waitFor(() => expect(provider.transport).toHaveBeenCalledTimes(2))
      provider.releases[0]()
      await vi.waitFor(async () => expect(decryptSecret((await prisma.shopifyShop.findUniqueOrThrow({ where: { id: shop.id } })).encryptedAccessToken)).toBe('refreshed-access-0'))
      provider.releases[1]()
      expect((await results).map(result => result.status).sort()).toEqual(['fulfilled', 'rejected'])
      const saved = await prisma.shopifyShop.findUniqueOrThrow({ where: { id: shop.id } })
      expect(decryptSecret(saved.encryptedAccessToken)).toBe('refreshed-access-0')
      expect(decryptSecret(saved.encryptedRefreshToken!)).toBe('refreshed-refresh-0')
    } finally { provider.releases.forEach(release => release()); await results }
  })
})
