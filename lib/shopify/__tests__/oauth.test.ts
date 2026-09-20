import { describe, expect, it } from 'vitest'
import { readShopifyInstallState, signShopifyInstallState, verifyShopifyInstallState } from '../oauth'

describe('Shopify install state', () => {
  it('round-trips a signed shop state', () => {
    process.env.BETTER_AUTH_SECRET = 'state-secret'
    const shop = 'demo.myshopify.com'
    const state = signShopifyInstallState(shop)
    expect(verifyShopifyInstallState(state, shop)).toBe(true)
    expect(verifyShopifyInstallState(state, 'other.myshopify.com')).toBe(false)
  })

  it('carries an account link inside the signed, expiring state', () => {
    process.env.BETTER_AUTH_SECRET = 'state-secret'
    const state = signShopifyInstallState('demo.myshopify.com', 'single-use-link')
    expect(readShopifyInstallState(state, 'demo.myshopify.com')).toEqual({
      accountLinkToken: 'single-use-link',
    })
    expect(readShopifyInstallState(state, 'other.myshopify.com')).toBeNull()
  })
})
