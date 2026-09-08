import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'

const findFirst = vi.hoisted(() => vi.fn())
const count = vi.hoisted(() => vi.fn())
const enqueueIntegrityProbe = vi.hoisted(() => vi.fn())
const requireShopDomain = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    revenuePath: { findFirst },
    verificationRun: { count },
  },
}))
vi.mock('@/lib/integrity/enqueue', () => ({ enqueueIntegrityProbe }))
vi.mock('@/lib/shopify/session', () => ({ requireShopDomain }))

import { POST } from '../route'

describe('POST /api/shopify/recheck', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireShopDomain.mockReturnValue({ shop: 'demo.myshopify.com' })
    findFirst.mockResolvedValue({ id: 'path-1' })
    count.mockResolvedValue(0)
    enqueueIntegrityProbe.mockResolvedValue(undefined)
  })

  it('requires a Shopify session', async () => {
    requireShopDomain.mockReturnValue({
      error: NextResponse.json({ error: 'Invalid ID token' }, { status: 401 }),
    })
    const response = await POST(
      new NextRequest('http://localhost/api/shopify/recheck', {
        method: 'POST',
        body: JSON.stringify({ pathId: 'path-1' }),
      })
    )
    expect(response.status).toBe(401)
  })

  it('enqueues a manual probe', async () => {
    const response = await POST(
      new NextRequest('http://localhost/api/shopify/recheck', {
        method: 'POST',
        body: JSON.stringify({ pathId: 'path-1' }),
      })
    )
    expect(response.status).toBe(200)
    expect(enqueueIntegrityProbe).toHaveBeenCalledWith('path-1', 'manual')
  })

  it('caps manual rechecks at five per day', async () => {
    count.mockResolvedValue(5)
    const response = await POST(
      new NextRequest('http://localhost/api/shopify/recheck', {
        method: 'POST',
        body: JSON.stringify({ pathId: 'path-1' }),
      })
    )
    expect(response.status).toBe(429)
    expect(enqueueIntegrityProbe).not.toHaveBeenCalled()
  })
})
