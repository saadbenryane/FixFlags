import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'

const uninstallShop = vi.hoisted(() => vi.fn())
const redactShop = vi.hoisted(() => vi.fn())
const create = vi.hoisted(() => vi.fn())
const findFirst = vi.hoisted(() => vi.fn())
const findMany = vi.hoisted(() => vi.fn())
const enqueueIntegrityProbe = vi.hoisted(() => vi.fn())

vi.mock('@/lib/shopify/uninstall', () => ({ uninstallShop, redactShop }))
vi.mock('@/lib/db', () => ({
  prisma: {
    shopifyShop: { findFirst },
    shopifyGdprRequest: { create },
    revenuePath: { findMany },
  },
}))
vi.mock('@/lib/integrity/enqueue', () => ({ enqueueIntegrityProbe }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), info: vi.fn() } }))

const SECRET = 'webhook-secret'

describe('POST /api/shopify/webhooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    process.env.SHOPIFY_API_SECRET = SECRET
    uninstallShop.mockResolvedValue(undefined)
    redactShop.mockResolvedValue(undefined)
    create.mockResolvedValue({})
    findFirst.mockResolvedValue({ id: 'shop-1' })
    findMany.mockResolvedValue([])
  })

  async function post(topic: string, body: string, shop = 'demo.myshopify.com') {
    const { POST } = await import('../route')
    const hmac = createHmac('sha256', SECRET).update(body, 'utf8').digest('base64')
    return POST(
      new Request('http://localhost/api/shopify/webhooks', {
        method: 'POST',
        headers: {
          'x-shopify-hmac-sha256': hmac,
          'x-shopify-topic': topic,
          'x-shopify-shop-domain': shop,
        },
        body,
      }) as never
    )
  }

  it('rejects a bad HMAC', async () => {
    const { POST } = await import('../route')
    const response = await POST(
      new Request('http://localhost/api/shopify/webhooks', {
        method: 'POST',
        headers: { 'x-shopify-hmac-sha256': 'nope', 'x-shopify-topic': 'app/uninstalled' },
        body: '{}',
      }) as never
    )
    expect(response.status).toBe(401)
  })

  it('marks the shop uninstalled', async () => {
    const response = await post('app/uninstalled', '{}')
    expect(response.status).toBe(200)
    expect(uninstallShop).toHaveBeenCalled()
  })

  it('deletes the shop on shop/redact', async () => {
    const response = await post('shop/redact', '{}')
    expect(response.status).toBe(200)
    expect(redactShop).toHaveBeenCalled()
  })

  it('persists a GDPR request receipt', async () => {
    const response = await post('customers/redact', '{"customer":{"id":1}}')
    expect(response.status).toBe(200)
    expect(create).toHaveBeenCalled()
  })
})
