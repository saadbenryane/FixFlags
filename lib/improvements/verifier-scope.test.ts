import { describe, expect, it } from 'vitest'
import { normalizeVerifierUrl, verifierScopeKey } from './verifier-scope'

describe('verification URL identity', () => {
  it.each([
    ['https://example.com/pricing', 'https://example.com/pricing/'],
    ['https://example.com/pricing/', 'https://example.com/pricing//'],
    ['https://example.com/?return=', 'https://example.com/?return=/'],
    ['https://example.com/pricing?return=/path', 'https://example.com/pricing?return=/path/'],
    ['https://example.com/#/pricing', 'https://example.com/#/help'],
    ['https://example.com/#/pricing', 'https://example.com/#/pricing/'],
    ['https://example.com/', 'https://example.com/#'],
  ])('does not equate distinct resources: %s and %s', (left, right) => {
    expect(normalizeVerifierUrl(left)).not.toBe(normalizeVerifierUrl(right))
    expect(verifierScopeKey(left)).not.toBe(verifierScopeKey(right))
  })
  it('retains the established root scope and canonical host and port without dropping browser state', () => {
    for (const url of ['https://example.com', 'https://example.com/', 'https://EXAMPLE.com:443/'])
      expect(verifierScopeKey(url)).toBe('page:https://example.com')
    expect(normalizeVerifierUrl('https://EXAMPLE.com:443/pricing/?return=/path/#section'))
      .toBe('https://example.com/pricing/?return=/path/#section')
    expect(verifierScopeKey(null)).toBe('product')
  })
})
