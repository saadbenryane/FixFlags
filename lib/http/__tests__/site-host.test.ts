import { describe, expect, it } from 'vitest'
import { isWwwApexPair, sharedCookieDomain, wwwApexPair } from '@/lib/http/site-host'

describe('sharedCookieDomain', () => {
  it('shares www and apex for the product host', () => {
    expect(sharedCookieDomain('https://fixflags.com')).toBe('.fixflags.com')
    expect(sharedCookieDomain('https://www.fixflags.com')).toBe('.fixflags.com')
  })

  it('does not set a parent domain on Railway or localhost', () => {
    expect(sharedCookieDomain('https://fixflags-prod.up.railway.app')).toBeUndefined()
    expect(sharedCookieDomain('http://localhost:3000')).toBeUndefined()
  })
})

describe('www/apex pair', () => {
  it('pairs www with apex only', () => {
    expect(wwwApexPair('www.fixflags.com')).toBe('fixflags.com')
    expect(wwwApexPair('fixflags.com')).toBe('www.fixflags.com')
    expect(isWwwApexPair('www.fixflags.com', 'fixflags.com')).toBe(true)
    expect(isWwwApexPair('fixflags.com', 'other.com')).toBe(false)
  })
})
