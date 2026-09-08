import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const updateMany = vi.hoisted(() => vi.fn())
const requireShopDomain = vi.hoisted(() => vi.fn())
const encryptSecret = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: { shopifyShop: { updateMany } } }))
vi.mock('@/lib/shopify/session', () => ({ requireShopDomain }))
vi.mock('@/lib/security/crypto', () => ({ encryptSecret }))

import { POST } from '../route'

describe('POST /api/shopify/slack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireShopDomain.mockReturnValue({ shop: 'demo.myshopify.com' })
    encryptSecret.mockReturnValue('enc')
    updateMany.mockResolvedValue({ count: 1 })
  })

  it('requires a Shopify session', async () => {
    requireShopDomain.mockReturnValue({
      error: NextResponse.json({ error: 'Invalid ID token' }, { status: 401 }),
    })
    const response = await POST(
      new NextRequest('http://localhost/api/shopify/slack', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl: 'https://hooks.slack.com/services/a/b/c' }),
      })
    )
    expect(response.status).toBe(401)
  })

  it('rejects a non-Slack URL', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/shopify/slack', {
        method: 'POST',
        body: JSON.stringify({ webhookUrl: 'https://example.com' }),
      })
    )
    expect(response.status).toBe(400)
  })
})
