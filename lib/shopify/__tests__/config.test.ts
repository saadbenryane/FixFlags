import { describe, expect, it } from 'vitest'
import { normalizeShopDomain } from '../config'

describe('normalizeShopDomain', () => {
  it('accepts a myshopify host and a bare store handle', () => {
    expect(normalizeShopDomain('Demo-Store.myshopify.com')).toBe('demo-store.myshopify.com')
    expect(normalizeShopDomain('https://demo-store.myshopify.com/admin')).toBe(
      'demo-store.myshopify.com'
    )
    expect(normalizeShopDomain('demo-store')).toBe('demo-store.myshopify.com')
  })

  it('rejects custom domains and junk', () => {
    expect(normalizeShopDomain('store.example.com')).toBeNull()
    expect(normalizeShopDomain('')).toBeNull()
    expect(normalizeShopDomain('https://evil.com')).toBeNull()
  })
})
