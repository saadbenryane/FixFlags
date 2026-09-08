import { createHmac } from 'node:crypto'
import { afterEach, describe, expect, it } from 'vitest'
import { verifyShopifyOAuthHmac, verifyShopifyWebhookHmac } from '../hmac'

const SECRET = 'shopify-test-secret'

describe('Shopify HMAC', () => {
  afterEach(() => {
    delete process.env.SHOPIFY_API_SECRET
  })

  it('accepts a valid OAuth query HMAC', () => {
    process.env.SHOPIFY_API_SECRET = SECRET
    const query = {
      shop: 'demo.myshopify.com',
      timestamp: '1710000000',
      hmac: '',
    }
    const message = `shop=${query.shop}&timestamp=${query.timestamp}`
    query.hmac = createHmac('sha256', SECRET).update(message).digest('hex')
    expect(verifyShopifyOAuthHmac(query)).toBe(true)
  })

  it('rejects a tampered OAuth HMAC', () => {
    process.env.SHOPIFY_API_SECRET = SECRET
    expect(
      verifyShopifyOAuthHmac({
        shop: 'demo.myshopify.com',
        hmac: 'deadbeef',
      })
    ).toBe(false)
  })

  it('accepts a valid webhook HMAC', () => {
    process.env.SHOPIFY_API_SECRET = SECRET
    const body = '{"id":1}'
    const header = createHmac('sha256', SECRET).update(body, 'utf8').digest('base64')
    expect(verifyShopifyWebhookHmac(body, header)).toBe(true)
  })

  it('rejects a missing webhook HMAC', () => {
    process.env.SHOPIFY_API_SECRET = SECRET
    expect(verifyShopifyWebhookHmac('{}', null)).toBe(false)
  })
})
