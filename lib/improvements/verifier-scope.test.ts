import { describe, expect, it } from 'vitest'
import { normalizeVerifierUrl, verifierScopeKey, verifierTargetKey } from './verifier-scope'

describe('verification URL identity', () => {
  it('requires stable target identity and keeps page scope separate', () => {
    expect(verifierTargetKey({ source: 'AI', checkId: null, fingerprint: null })).toBeNull()
    expect(verifierTargetKey({ source: 'AI', checkId: null, fingerprint: 'evidence-1' })).toBe('ai:evidence-1')
    expect(verifierTargetKey({ source: 'DETERMINISTIC', checkId: 'cta-dead-link::page:2' })).toBe('check:cta-dead-link')
  })
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
