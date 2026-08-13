import assert from 'node:assert/strict'
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { PageMetadata } from '../metadata'
import {
  discoverCriticalPathUrls,
  discoverCriticalPathUrlsEnriched,
} from '../critical-path'

const fetchMock = vi.fn()

type Link = { href: string; text: string; rel?: string | null }

function metadataWith(links: Link[]) {
  return {
    links: links.map((l) => ({ ...l, rel: l.rel ?? null })),
  } as unknown as PageMetadata
}

function htmlLinks(links: Link[]): string {
  return links
    .map((l) => `<a href="${l.href}">${l.text}</a>`)
    .join('\n')
}

function sitemapXml(locs: string[]): string {
  return `<?xml version="1.0" encoding="UTF-8"?><urlset>${locs
    .map((loc) => `<url><loc>${loc}</loc></url>`)
    .join('')}</urlset>`
}

describe('discoverCriticalPathUrls', () => {
  it('always includes the primary URL as the first page', () => {
    const pages = discoverCriticalPathUrls('https://example.com/', metadataWith([]))
    assert.equal(pages.length, 1)
    assert.equal(pages[0].url, 'https://example.com/')
    assert.equal(pages[0].category, 'primary')
  })

  it('ranks pricing and primary-cta links ahead of features and resources', () => {
    const pages = discoverCriticalPathUrls('https://example.com/', metadataWith([
        { href: '/blog', text: 'Blog' },
        { href: '/pricing', text: 'Pricing' },
        { href: '/signup', text: 'Get started' },
        { href: '/features', text: 'Features' },
      ]))
    const urls = pages.map((p) => p.url)
    assert.deepEqual(urls, [
      'https://example.com/',
      'https://example.com/pricing',
      'https://example.com/signup',
      'https://example.com/features',
      'https://example.com/blog',
    ])
  })

  it('ignores external and dead links', () => {
    const pages = discoverCriticalPathUrls('https://example.com/', metadataWith([
        { href: 'https://other-site.com/pricing', text: 'Pricing' },
        { href: 'javascript:void(0)', text: 'Broken' },
        { href: '/pricing', text: 'Pricing' },
      ]))
    const urls = pages.map((p) => p.url)
    assert.ok(urls.includes('https://example.com/pricing'))
    assert.ok(!urls.some((u) => u.includes('other-site.com')))
  })

  it('normalizes URLs (strips hash and trailing slash)', () => {
    const pages = discoverCriticalPathUrls('https://example.com/', metadataWith([
        { href: '/pricing/', text: 'Pricing' },
        { href: '/signup#step-2', text: 'Sign up' },
      ]))
    const urls = pages.map((p) => p.url)
    assert.ok(urls.includes('https://example.com/pricing'))
    assert.ok(urls.includes('https://example.com/signup'))
  })

  it('enforces category diversity caps', () => {
    const pages = discoverCriticalPathUrls(
      'https://example.com/',
      metadataWith(Array.from({ length: 10 }, (_, i) => ({
        href: `/pricing?v=${i}`,
        text: 'Pricing',
      })))
    )
    const pricingCount = pages.filter((p) => p.category === 'pricing').length
    assert.ok(pricingCount >= 1)
    assert.ok(pricingCount <= 2)
    assert.ok(pages.length <= 6)
  })

  it('respects the maxUrls bound', () => {
    const pages = discoverCriticalPathUrls(
      'https://example.com/',
      metadataWith([
          { href: '/pricing', text: 'Pricing' },
          { href: '/signup', text: 'Sign up' },
          { href: '/features', text: 'Features' },
          { href: '/about', text: 'About' },
          { href: '/blog', text: 'Blog' },
          { href: '/contact', text: 'Contact' },
          { href: '/careers', text: 'Careers' },
        ])
    )
    assert.ok(pages.length <= 6)
  })
})

describe('discoverCriticalPathUrlsEnriched', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubFetch(handler: (url: string) => Promise<Response> | Response) {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      return handler(url)
    })
    vi.stubGlobal('fetch', fetchMock)
  }

  it('returns immediately without network calls when pricing and primary-cta are present', async () => {
    stubFetch(() => {
      throw new Error('fetch should not be called')
    })
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([
        { href: '/pricing', text: 'Pricing' },
        { href: '/signup', text: 'Get started' },
      ]))
    assert.ok(pages.some((p) => p.category === 'pricing'))
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('enriches from the sitemap when pricing is missing', async () => {
    stubFetch((url) => {
      if (url.endsWith('/sitemap.xml')) {
        return new Response(sitemapXml(['https://example.com/pricing', 'https://example.com/signup']), {
          status: 200,
        })
      }
      return new Response('<html></html>', { status: 200 })
    })
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([{ href: '/features', text: 'Features' }]))
    assert.ok(pages.some((p) => p.url === 'https://example.com/pricing'))
    assert.ok(pages.some((p) => p.url === 'https://example.com/signup'))
  })

  it('performs one-hop BFS when sitemap yields nothing', async () => {
    const hopLinks = htmlLinks([
      { href: '/pricing', text: 'Pricing' },
      { href: '/signup', text: 'Sign up' },
    ])
    stubFetch((url) => {
      if (url.endsWith('/sitemap.xml')) return new Response('<urlset></urlset>', { status: 200 })
      if (url.includes('/features')) return new Response(hopLinks, { status: 200 })
      return new Response('<html></html>', { status: 200 })
    })
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([{ href: '/features', text: 'Features' }]))
    assert.ok(pages.some((p) => p.url === 'https://example.com/pricing'))
  })

  it('returns homepage discovery when enrichment finds nothing', async () => {
    stubFetch((url) => {
      if (url.endsWith('/sitemap.xml')) return new Response('<urlset></urlset>', { status: 200 })
      return new Response('<html>nothing useful</html>', { status: 200 })
    })
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([]))
    assert.equal(pages.length, 1)
    assert.equal(pages[0].url, 'https://example.com/')
  })

  it('handles a failing sitemap fetch gracefully', async () => {
    stubFetch(() => {
      throw new Error('network down')
    })
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([]))
    assert.equal(pages.length, 1)
  })

  it('handles a non-ok sitemap response gracefully', async () => {
    stubFetch(() => new Response('nope', { status: 404 }))
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([]))
    assert.equal(pages.length, 1)
  })

  it('passes scan access headers to sitemap and BFS fetches', async () => {
    fetchMock.mockReset()
    fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : input.toString()
      if (url.endsWith('/sitemap.xml')) {
        return new Response(
          sitemapXml(['https://example.com/pricing']),
          { status: 200 }
        )
      }
      return new Response('<html></html>', { status: 200 })
    })
    vi.stubGlobal('fetch', fetchMock)
    const pages = await discoverCriticalPathUrlsEnriched(
      'https://example.com/',
      metadataWith([{ href: '/blog', text: 'Blog' }]),
      { headers: { 'X-FixFlags-Token': 'abc' } }
    )
    assert.ok(pages.some((p) => p.category === 'pricing'))
    const calls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith('/sitemap.xml')
    )
    assert.equal(calls.length, 1)
    const headers = (calls[0][1] as RequestInit | undefined)?.headers as Record<string, string> | undefined
    assert.equal(headers?.['X-FixFlags-Token'], 'abc')
  })

  it('does not fetch a page that equals the primary URL as BFS seed', async () => {
    const calls: string[] = []
    stubFetch((url) => {
      calls.push(url)
      if (url.endsWith('/sitemap.xml')) return new Response('<urlset></urlset>', { status: 200 })
      return new Response(htmlLinks([{ href: '/pricing', text: 'Pricing' }]), { status: 200 })
    })
    await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([{ href: 'https://example.com', text: 'Home' }]))
    assert.equal(calls.filter((c) => !c.endsWith('/sitemap.xml')).length, 0)
  })

  it('deduplicates merged candidates keeping the highest score', async () => {
    stubFetch((url) => {
      if (url.endsWith('/sitemap.xml')) {
        return new Response(sitemapXml(['https://example.com/pricing']), { status: 200 })
      }
      return new Response('<html></html>', { status: 200 })
    })
    const pages = await discoverCriticalPathUrlsEnriched('https://example.com/', metadataWith([
        { href: '/pricing', text: 'Pricing' },
        { href: '/blog', text: 'Blog' },
      ]))
    const pricing = pages.filter((p) => p.url === 'https://example.com/pricing')
    assert.equal(pricing.length, 1)
  })
})
