import { describe, expect, it } from 'vitest'
import { safeFormRequestAllowed } from '../safe-form-safety'

const base = { url: 'https://example.com/api/signup', method: 'POST', navigation: false,
  origin: 'https://example.com', values: ['synthetic@example.test', 'synthetic-password'] }
describe('authorized fixture request safety', () => {
  it('permits the authorized origin and public static resources while retaining downstream SSRF enforcement', () => {
    expect(safeFormRequestAllowed(base)).toBe(true)
    expect(safeFormRequestAllowed({ ...base, url: 'https://cdn.example/assets.js', method: 'GET' })).toBe(true)
  })
  it('refuses cross-origin submissions, other ports, navigation, payments and secret-bearing third-party URLs', () => {
    for (const change of [
      { url: 'https://other.example/signup' }, { url: 'https://example.com:8443/signup' },
      { url: 'https://other.example/', method: 'GET', navigation: true }, { url: 'https://example.com/cart/add.js' },
      { url: 'https://checkout.stripe.com/session' },
      { url: 'https://other.example/collect?email=synthetic%40example.test', method: 'GET' },
    ]) expect(safeFormRequestAllowed({ ...base, ...change })).toBe(false)
  })
})
