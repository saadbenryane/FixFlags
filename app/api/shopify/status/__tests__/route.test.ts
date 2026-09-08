import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const loadInstalledShop = vi.hoisted(() => vi.fn())
const countManualRechecksToday = vi.hoisted(() => vi.fn())
const requireShopDomain = vi.hoisted(() => vi.fn())

vi.mock('@/lib/shopify/load-shop', () => ({ loadInstalledShop, countManualRechecksToday }))
vi.mock('@/lib/shopify/session', () => ({ requireShopDomain }))

import { GET } from '../route'

describe('GET /api/shopify/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireShopDomain.mockReturnValue({ shop: 'demo.myshopify.com' })
    countManualRechecksToday.mockResolvedValue(1)
    loadInstalledShop.mockResolvedValue({
      shopDomain: 'demo.myshopify.com',
      name: 'Demo',
      email: 'owner@example.com',
      slackWebhookEncrypted: null,
      paths: [],
      waitlist: [],
    })
  })

  it('requires a Shopify session', async () => {
    requireShopDomain.mockReturnValue({
      error: NextResponse.json({ error: 'Invalid ID token' }, { status: 401 }),
    })
    const response = await GET(new NextRequest('http://localhost/api/shopify/status'))
    expect(response.status).toBe(401)
  })

  it('returns a workspace projection', async () => {
    const response = await GET(new NextRequest('http://localhost/api/shopify/status'))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.shop.shopDomain).toBe('demo.myshopify.com')
    expect(body.emptyCatalog).toBe(true)
    expect(body.rechecksRemaining).toBe(4)
  })
})
