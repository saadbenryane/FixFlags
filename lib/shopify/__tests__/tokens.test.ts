import { createHmac } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { ShopifyIdTokenError, verifyShopifyIdToken } from '../tokens'

function sign(payload: Record<string, unknown>, secret: string): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url')
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const sig = createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}

describe('verifyShopifyIdToken', () => {
  it('accepts a valid shop dest', () => {
    process.env.SHOPIFY_API_SECRET = 'secret'
    process.env.SHOPIFY_API_KEY = 'key'
    const now = Math.floor(Date.now() / 1000)
    const token = sign(
      {
        aud: 'key',
        iss: 'https://demo.myshopify.com/admin',
        dest: 'https://demo.myshopify.com',
        exp: now + 60,
        nbf: now - 1,
        sub: '1',
      },
      'secret'
    )
    expect(verifyShopifyIdToken(token).shop).toBe('demo.myshopify.com')
  })

  it('rejects a bad audience', () => {
    process.env.SHOPIFY_API_SECRET = 'secret'
    process.env.SHOPIFY_API_KEY = 'key'
    const now = Math.floor(Date.now() / 1000)
    const token = sign(
      {
        aud: 'other',
        iss: 'https://demo.myshopify.com/admin',
        dest: 'https://demo.myshopify.com',
        exp: now + 60,
        nbf: now - 1,
      },
      'secret'
    )
    expect(() => verifyShopifyIdToken(token)).toThrow(ShopifyIdTokenError)
  })
})
