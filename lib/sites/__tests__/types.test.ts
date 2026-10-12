import { describe, expect, it } from 'vitest'
import { siteUrlParts } from '../types'

describe('Site identity and executable origin', () => {
  it.each([
    ['http://www.example.com:8080/pricing?campaign=one#start', 'http://www.example.com:8080'],
    ['https://www.example.com/contact', 'https://www.example.com'],
    ['https://example.com:8443/', 'https://example.com:8443'],
  ])('preserves the supplied origin for %s while sharing hostname identity', (input, origin) => {
    expect(siteUrlParts(input)).toEqual({ canonicalHost: 'example.com', canonicalUrl: origin })
  })
  it.each(['invalid', 'file:///tmp/site', 'ftp://example.com/'])('refuses a non-web Site %s', input => {
    expect(siteUrlParts(input)).toBeNull()
  })
})
