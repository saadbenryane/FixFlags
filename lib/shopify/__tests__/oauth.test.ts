import { describe, expect, it } from 'vitest'
import { signShopifyInstallState, verifyShopifyInstallState } from '../oauth'

describe('Shopify install state', () => {
  it('round-trips a signed shop state', () => {
    process.env.BETTER_AUTH_SECRET = 'state-secret'
    const shop = 'demo.myshopify.com'
    const state = signShopifyInstallState(shop)
    expect(verifyShopifyInstallState(state, shop)).toBe(true)
    expect(verifyShopifyInstallState(state, 'other.myshopify.com')).toBe(false)
  })
})
