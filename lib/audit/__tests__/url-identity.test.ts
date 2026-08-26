import { describe, expect, it } from 'vitest'
import {
  canonicalizeDestination,
  canonicalDestinationKey,
  collectEligibleDestinations,
  isEligiblePublicDestination,
  reviewPathLabel,
  sameCanonicalDestination,
} from '@/lib/audit/url-identity'

const ORIGIN = 'https://example.com/'

describe('url identity', () => {
  it('strips hashes, trailing slashes, and tracking params', () => {
    const a = canonicalDestinationKey('https://example.com/pricing/?utm_source=ad#hero')
    const b = canonicalDestinationKey('https://example.com/pricing')
    expect(a).toBe(b)
  })

  it('treats www and apex as the same destination', () => {
    expect(
      sameCanonicalDestination('https://www.example.com/about', 'https://example.com/about/')
    ).toBe(true)
  })

  it('drops generated pagination and facet query params', () => {
    const a = canonicalDestinationKey('https://example.com/shop?page=2&sort=price')
    const b = canonicalDestinationKey('https://example.com/shop')
    expect(a).toBe(b)
  })

  it('keeps meaningful query parameters', () => {
    const a = canonicalDestinationKey('https://example.com/item?id=42')
    const b = canonicalDestinationKey('https://example.com/item')
    expect(a).not.toBe(b)
  })

  it('collapses locale prefixes and locale query params', () => {
    expect(
      sameCanonicalDestination('https://example.com/en/pricing', 'https://example.com/pricing')
    ).toBe(true)
    expect(
      sameCanonicalDestination('https://example.com/pricing?lang=en', 'https://example.com/pricing')
    ).toBe(true)
  })

  it('does not multiply generated pagination path variants', () => {
    expect(
      sameCanonicalDestination('https://example.com/blog/page/2', 'https://example.com/blog')
    ).toBe(true)
  })

  it('skips mailto, files, and hash-only hrefs', () => {
    expect(isEligiblePublicDestination('mailto:hi@example.com', ORIGIN)).toBe(false)
    expect(isEligiblePublicDestination('/brand.pdf', ORIGIN)).toBe(false)
    expect(isEligiblePublicDestination('#pricing', ORIGIN)).toBe(false)
    expect(isEligiblePublicDestination('/pricing', ORIGIN)).toBe(true)
    expect(isEligiblePublicDestination('/login', ORIGIN)).toBe(true)
  })

  it('deduplicates eligible destinations from mixed variants', () => {
    const collected = collectEligibleDestinations(ORIGIN, [
      { href: '/pricing', text: 'Pricing' },
      { href: 'https://www.example.com/pricing/', text: 'Plans' },
      { href: '/pricing?utm_campaign=home', text: 'Pricing again' },
      { href: 'https://other.com/x', text: 'External' },
      { href: 'mailto:sales@example.com', text: 'Email' },
    ])
    expect(collected.map((item) => item.canonical.pathname)).toEqual(['/pricing'])
  })

  it('labels Home for the origin path', () => {
    expect(reviewPathLabel('https://example.com/')).toBe('Home')
    expect(reviewPathLabel('https://example.com/pricing')).toBe('/pricing')
  })

  it('preserves a fetchable url on the canonical destination', () => {
    const canonical = canonicalizeDestination('https://Example.com/Checkout/?fbclid=abc#x')
    expect(canonical?.url).toBe('https://example.com/Checkout')
  })
})
