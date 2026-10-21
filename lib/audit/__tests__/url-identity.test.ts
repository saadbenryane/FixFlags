import { describe, expect, it } from 'vitest'
import {
  canonicalizeDestination,
  canonicalDestinationKey,
  collectEligibleDestinations,
  isEligiblePublicDestination,
  reviewPathLabel,
  sameCanonicalDestination,
  navigationDestinationKey,
} from '@/lib/audit/url-identity'

const ORIGIN = 'https://example.com/'

describe('url identity', () => {
  it('refuses embedded credentials instead of changing the destination to a public request', () => {
    for (const url of ['https://user:secret@example.com/private', '//user@example.com/private']) {
      expect(canonicalizeDestination(url, ORIGIN)).toBeNull()
      expect(navigationDestinationKey(url, ORIGIN)).toBeNull()
      expect(isEligiblePublicDestination(url, ORIGIN)).toBe(false)
    }
  })

  it('separates executable navigation from discovery grouping for admitted URL variants', () => {
    for (const [left, right] of [
      [ORIGIN + 'pricing', ORIGIN + 'pricing/'],
      [ORIGIN + 'pricing?utm_campaign=one', ORIGIN + 'pricing?utm_campaign=two'],
      [ORIGIN + 'pricing?a=1&b=2', ORIGIN + 'pricing?b=2&a=1'],
      [ORIGIN + 'pricing?plan=one&plan=two', ORIGIN + 'pricing?plan=two&plan=one'],
      [ORIGIN + 'pricing?', ORIGIN + 'pricing'],
      [ORIGIN + 'pricing', 'https://www.example.com/pricing'],
      [ORIGIN + 'fr/pricing', ORIGIN + 'pricing'],
      [ORIGIN + 'pricing?page=2', ORIGIN + 'pricing'],
      [ORIGIN + 'app#start', ORIGIN + 'app#reset'],
      [ORIGIN + 'app#', ORIGIN + 'app'],
    ]) {
      expect(sameCanonicalDestination(left, right)).toBe(true)
      expect(navigationDestinationKey(left)).not.toBe(navigationDestinationKey(right))
    }
    expect(navigationDestinationKey(ORIGIN)).toBe(navigationDestinationKey('https://example.com'))
    expect(navigationDestinationKey('javascript:alert(1)')).toBeNull()
  })
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
    expect(canonical?.url).toBe('https://example.com/Checkout/?fbclid=abc')
  })

  it('deduplicates variants without changing the actual host, locale, path or query to fetch', () => {
    const raw = 'https://www.example.com/en/pricing/?lang=en&page=2&token=private#details'
    const canonical = canonicalizeDestination(raw)!
    expect(canonical.url).toBe(raw.split('#')[0])
    expect(canonical.key).toBe(canonicalDestinationKey('https://example.com/pricing?token=private'))
    expect(collectEligibleDestinations(ORIGIN, [{ href: raw, text: 'Pricing' }])[0].href).toBe(raw.split('#')[0])
  })
})
