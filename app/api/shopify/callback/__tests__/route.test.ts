import { beforeEach, describe, expect, it, vi } from 'vitest'

const isShopifyConfigured = vi.hoisted(() => vi.fn())
const normalizeShopDomain = vi.hoisted(() => vi.fn())
const verifyShopifyOAuthHmac = vi.hoisted(() => vi.fn())
const readShopifyInstallState = vi.hoisted(() => vi.fn())
const exchangeShopifyCode = vi.hoisted(() => vi.fn())
const persistInstalledShop = vi.hoisted(() => vi.fn())
const shopifyApiKey = vi.hoisted(() => vi.fn())
const consumeShopifyAccountLink = vi.hoisted(() => vi.fn())

vi.mock('@/lib/shopify/config', () => ({
  isShopifyConfigured,
  normalizeShopDomain,
  shopifyApiKey,
}))
vi.mock('@/lib/shopify/hmac', () => ({ verifyShopifyOAuthHmac }))
vi.mock('@/lib/shopify/oauth', () => ({ readShopifyInstallState, exchangeShopifyCode }))
vi.mock('@/lib/shopify/account-link', () => ({ consumeShopifyAccountLink }))
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
    readShopifyInstallState.mockReturnValue({ accountLinkToken: null })
    shopifyApiKey.mockReturnValue('api-key')
    exchangeShopifyCode.mockResolvedValue({
      accessToken: 'token',
      refreshToken: 'refresh',
      scope: 'read_products',
      expiresAt: new Date(),
      refreshExpiresAt: new Date(),
    })
    persistInstalledShop.mockResolvedValue({ shopId: 's1', pathId: 'p1' })
    consumeShopifyAccountLink.mockResolvedValue({ projectId: 'p1' })
  })

  it('rejects a missing code', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/shopify/callback?shop=demo.myshopify.com&state=s')
    )
    expect(response.headers.get('location')).toContain('/docs/integrations/shopify?error=missing')
    expect(exchangeShopifyCode).not.toHaveBeenCalled()
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

  it.each(['not_configured', 'missing', 'hmac', 'state'] as const)('returns %s failures to the guide before exchanging credentials', async (reason) => {
    if (reason === 'not_configured') isShopifyConfigured.mockReturnValue(false)
    if (reason === 'missing') normalizeShopDomain.mockReturnValue(null)
    if (reason === 'hmac') verifyShopifyOAuthHmac.mockReturnValue(false)
    if (reason === 'state') readShopifyInstallState.mockReturnValue(null)
    const response = await GET(new NextRequest('http://localhost/api/shopify/callback?shop=demo.myshopify.com&code=abc&state=s&hmac=sig'))
    expect(response.headers.get('location')).toBe(`http://localhost:3000/docs/integrations/shopify?error=${reason}`)
    expect(exchangeShopifyCode).not.toHaveBeenCalled()
    expect(persistInstalledShop).not.toHaveBeenCalled()
    expect(consumeShopifyAccountLink).not.toHaveBeenCalled()
  })

  it('attaches an authorized installation using its verified account link', async () => {
    readShopifyInstallState.mockReturnValue({ accountLinkToken: 'single-use-link' })
    const response = await GET(new NextRequest('http://localhost/api/shopify/callback?shop=demo.myshopify.com&code=abc&state=s'))
    expect(consumeShopifyAccountLink).toHaveBeenCalledWith({ token: 'single-use-link', shopDomain: 'demo.myshopify.com' })
    expect(response.headers.get('location')).toBe('https://admin.shopify.com/store/demo/apps/api-key')
  })

  it.each(['code exchange', 'expired account link', 'already attached store'])('sends %s failures to safe recovery without leaking the error', async (failure) => {
    if (failure === 'code exchange') exchangeShopifyCode.mockRejectedValue(new Error('provider secret'))
    else {
      readShopifyInstallState.mockReturnValue({ accountLinkToken: 'single-use-link' })
      consumeShopifyAccountLink.mockRejectedValue(new Error(failure))
    }
    const response = await GET(new NextRequest('http://localhost/api/shopify/callback?shop=demo.myshopify.com&code=abc&state=s'))
    expect(response.headers.get('location')).toBe('http://localhost:3000/docs/integrations/shopify?error=token')
  })

  it('retains the embedded fallback when no Admin app key is available', async () => {
    shopifyApiKey.mockReturnValue('')
    const response = await GET(new NextRequest('http://localhost/api/shopify/callback?shop=demo.myshopify.com&code=abc&state=s'))
    expect(response.headers.get('location')).toBe('http://localhost:3000/shopify?shop=demo.myshopify.com')
  })
})
