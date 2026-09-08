import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const findFirst = vi.hoisted(() => vi.fn())
const upsert = vi.hoisted(() => vi.fn())
const requireShopDomain = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    shopifyShop: { findFirst },
    integrityWaitlist: { upsert },
  },
}))
vi.mock('@/lib/shopify/session', () => ({ requireShopDomain }))

import { POST } from '../route'

describe('POST /api/integrity/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireShopDomain.mockReturnValue({ shop: 'demo.myshopify.com' })
    findFirst.mockResolvedValue({ id: 'shop-1', email: 'owner@example.com' })
    upsert.mockResolvedValue({})
  })

  it('requires a Shopify session', async () => {
    requireShopDomain.mockReturnValue({
      error: NextResponse.json({ error: 'Invalid ID token' }, { status: 401 }),
    })
    const response = await POST(
      new NextRequest('http://localhost/api/integrity/waitlist', {
        method: 'POST',
        body: JSON.stringify({ featureKey: 'extra_paths' }),
      })
    )
    expect(response.status).toBe(401)
  })

  it('records a waitlist key', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/integrity/waitlist', {
        method: 'POST',
        body: JSON.stringify({ featureKey: 'extra_paths' }),
      })
    )
    expect(response.status).toBe(200)
    expect(upsert).toHaveBeenCalled()
  })
})
