import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/shopify/session', async () => {
  const actual = await vi.importActual<typeof import('@/lib/shopify/session')>('@/lib/shopify/session')
  return {
    ...actual,
    requireShopDomain: vi.fn(),
    readShopifyIdToken: vi.fn(),
  }
})
vi.mock('@/lib/shopify/fixture-session', () => ({ isShopifyFixtureMode: () => true }))
vi.mock('@/lib/shopify/tokens', () => ({
  exchangeIdToken: vi.fn(),
  persistTokenSet: vi.fn(),
  ShopifyIdTokenError: class extends Error {},
}))

import { POST } from '../route'
import { requireShopDomain } from '@/lib/shopify/session'

describe('POST /api/shopify/session', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(requireShopDomain).mockReturnValue({ shop: 'demo.myshopify.com' })
  })

  it('accepts fixture mode without token exchange', async () => {
    const response = await POST(new NextRequest('http://localhost/api/shopify/session', { method: 'POST' }))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ fixture: true })
  })
})
