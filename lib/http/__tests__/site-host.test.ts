import { describe, expect, it } from 'vitest'
import { cookieDomainForHostname, isWwwApexPair, sharedCookieDomain, wwwApexPair } from '@/lib/http/site-host'

describe('sharedCookieDomain', () => {
  it('shares www and apex for the product host', () => {
    expect(sharedCookieDomain('https://fixflags.com')).toBe('.fixflags.com')
    expect(sharedCookieDomain('https://www.fixflags.com')).toBe('.fixflags.com')
  })

  it('does not set a parent domain on Railway or localhost', () => {
    expect(sharedCookieDomain('https://fixflags-prod.up.railway.app')).toBeUndefined()
    expect(sharedCookieDomain('http://localhost:3000')).toBeUndefined()
  })

  it('prefers the incoming Host so www and apex share the claim cookie', () => {
    expect(sharedCookieDomain('https://fixflags-prod.up.railway.app', 'www.fixflags.com')).toBe(
      '.fixflags.com'
    )
    expect(sharedCookieDomain('https://fixflags-prod.up.railway.app', 'fixflags.com')).toBe(
      '.fixflags.com'
    )
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

describe('cookieDomainForHostname', () => {
  it('shares www and apex and ignores ports', () => {
    expect(cookieDomainForHostname('www.fixflags.com:443')).toBe('.fixflags.com')
    expect(cookieDomainForHostname('fixflags.com')).toBe('.fixflags.com')
  })
})
