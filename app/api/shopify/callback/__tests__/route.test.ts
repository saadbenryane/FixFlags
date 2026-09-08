import { beforeEach, describe, expect, it, vi } from 'vitest'

const isShopifyConfigured = vi.hoisted(() => vi.fn())
const normalizeShopDomain = vi.hoisted(() => vi.fn())
const verifyShopifyOAuthHmac = vi.hoisted(() => vi.fn())
const verifyShopifyInstallState = vi.hoisted(() => vi.fn())
const exchangeShopifyCode = vi.hoisted(() => vi.fn())
const persistInstalledShop = vi.hoisted(() => vi.fn())
const shopifyApiKey = vi.hoisted(() => vi.fn())

vi.mock('@/lib/shopify/config', () => ({
  isShopifyConfigured,
  normalizeShopDomain,
  shopifyApiKey,
}))
vi.mock('@/lib/shopify/hmac', () => ({ verifyShopifyOAuthHmac }))
vi.mock('@/lib/shopify/oauth', () => ({ verifyShopifyInstallState, exchangeShopifyCode }))
vi.mock('@/lib/shopify/install-shop', () => ({ persistInstalledShop }))
vi.mock('@/lib/get-app-url', () => ({ getAppUrl: () => 'http://localhost:3000' }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))

import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/shopify/callback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isShopifyConfigured.mockReturnValue(true)
    normalizeShopDomain.mockReturnValue('demo.myshopify.com')
    verifyShopifyOAuthHmac.mockReturnValue(true)
    verifyShopifyInstallState.mockReturnValue(true)
    shopifyApiKey.mockReturnValue('api-key')
    exchangeShopifyCode.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      scope: 'read_products',
      expiresAt: new Date(),
      refreshExpiresAt: new Date(),
    })
    persistInstalledShop.mockResolvedValue({ shopId: 's1', pathId: 'p1' })
  })

  it('rejects a missing code', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/shopify/callback?shop=demo.myshopify.com&state=s')
    )
    expect(response.headers.get('location')).toContain('/install?error=missing')
  })

  it('persists the shop and redirects into Admin', async () => {
    const response = await GET(
      new NextRequest(
        'http://localhost/api/shopify/callback?shop=demo.myshopify.com&code=abc&state=s'
      )
    )
    expect(persistInstalledShop).toHaveBeenCalled()
    expect(response.headers.get('location')).toBe(
      'https://admin.shopify.com/store/demo/apps/api-key'
    )
  })
})
