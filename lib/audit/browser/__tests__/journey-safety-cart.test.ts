import { describe, expect, it } from 'vitest'
import { isCartMutationPath } from '@/lib/audit/browser/journey-safety'

describe('isCartMutationPath', () => {
  it('allows Shopify cart add and checkout paths', () => {
    expect(isCartMutationPath('https://store.example/cart/add.js')).toBe(true)
    expect(isCartMutationPath('https://store.example/cart/add')).toBe(true)
    expect(isCartMutationPath('https://store.example/checkouts/cn/abc')).toBe(true)
  })

  it('does not treat unrelated posts as cart mutations', () => {
    expect(isCartMutationPath('https://store.example/account/login')).toBe(false)
    expect(isCartMutationPath('https://checkout.stripe.com/pay')).toBe(false)
  })
})
