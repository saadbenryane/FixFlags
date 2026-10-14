import { beforeEach, describe, expect, it, vi } from 'vitest'
const integrationRelease = vi.hoisted(() => vi.fn(() => 'available'))
vi.mock('@/lib/integrations/release-policy', () => ({ integrationRelease }))

const isShopifyConfigured = vi.hoisted(() => vi.fn())
const normalizeShopDomain = vi.hoisted(() => vi.fn())
const verifyShopifyOAuthHmac = vi.hoisted(() => vi.fn())
const signShopifyInstallState = vi.hoisted(() => vi.fn())
const buildShopifyAuthorizeUrl = vi.hoisted(() => vi.fn())
const accountLinkIsUsable = vi.hoisted(() => vi.fn())

vi.mock('@/lib/shopify/config', () => ({ isShopifyConfigured, normalizeShopDomain }))
vi.mock('@/lib/shopify/hmac', () => ({ verifyShopifyOAuthHmac }))
vi.mock('@/lib/shopify/oauth', () => ({ signShopifyInstallState, buildShopifyAuthorizeUrl }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))
vi.mock('@/lib/shopify/account-link', () => ({ accountLinkIsUsable }))

import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/shopify/auth', () => {
  it('does not admit provider authorization while Shopify is coming soon', async () => {
    integrationRelease.mockReturnValue('planned')
    const response = await GET(new NextRequest('http://localhost/api/shopify/auth?shop=demo.myshopify.com'))
    expect(response.status).toBe(409)
    expect(await response.json()).toMatchObject({ code: 'INTEGRATION_COMING_SOON' })
    expect(signShopifyInstallState).not.toHaveBeenCalled()
  })
  beforeEach(() => {
    vi.clearAllMocks()
    integrationRelease.mockReturnValue('available')
    isShopifyConfigured.mockReturnValue(true)
    normalizeShopDomain.mockReturnValue('demo.myshopify.com')
    signShopifyInstallState.mockReturnValue('state')
    buildShopifyAuthorizeUrl.mockReturnValue('https://demo.myshopify.com/admin/oauth/authorize')
    accountLinkIsUsable.mockResolvedValue(true)
  })

  it('rejects an invalid shop domain', async () => {
    normalizeShopDomain.mockReturnValue(null)
    const response = await GET(
      new NextRequest('http://localhost/api/shopify/auth?shop=nope')
    )
    expect(response.status).toBe(400)
  })

  it('redirects to Shopify authorize', async () => {
    const response = await GET(
      new NextRequest('http://localhost/api/shopify/auth?shop=demo.myshopify.com')
    )
    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('oauth/authorize')
  })

  it('rejects an expired account link before leaving FixFlags', async () => {
    accountLinkIsUsable.mockResolvedValue(false)
    const response = await GET(
      new NextRequest('http://localhost/api/shopify/auth?shop=demo.myshopify.com&link=expired')
    )
    expect(response.status).toBe(400)
    expect(buildShopifyAuthorizeUrl).not.toHaveBeenCalled()
  })
})
