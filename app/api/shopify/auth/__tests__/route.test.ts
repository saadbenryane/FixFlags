import { beforeEach, describe, expect, it, vi } from 'vitest'

const isShopifyConfigured = vi.hoisted(() => vi.fn())
const normalizeShopDomain = vi.hoisted(() => vi.fn())
const verifyShopifyOAuthHmac = vi.hoisted(() => vi.fn())
const signShopifyInstallState = vi.hoisted(() => vi.fn())
const buildShopifyAuthorizeUrl = vi.hoisted(() => vi.fn())

vi.mock('@/lib/shopify/config', () => ({ isShopifyConfigured, normalizeShopDomain }))
vi.mock('@/lib/shopify/hmac', () => ({ verifyShopifyOAuthHmac }))
vi.mock('@/lib/shopify/oauth', () => ({ signShopifyInstallState, buildShopifyAuthorizeUrl }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent: vi.fn() }))

import { NextRequest } from 'next/server'
import { GET } from '../route'

describe('GET /api/shopify/auth', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isShopifyConfigured.mockReturnValue(true)
    normalizeShopDomain.mockReturnValue('demo.myshopify.com')
    signShopifyInstallState.mockReturnValue('state')
    buildShopifyAuthorizeUrl.mockReturnValue('https://demo.myshopify.com/admin/oauth/authorize')
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
})
