import { beforeEach, describe, expect, it, vi } from 'vitest'
const safeFetchDocument = vi.hoisted(() => vi.fn())
vi.mock('../../url', () => ({ safeFetchDocument }))
import { collectDocument, collectSearchEvidence, collectSiteResources, parseSitemap, SITEMAP_DOCUMENT_LIMIT } from '../collect'
import { document, PAGE } from './fixtures'

beforeEach(() => vi.clearAllMocks())
describe('bounded Search resource collection', () => {
  it('collects active HTML canonical targets against the document base and HTTP declarations against the response URL', async () => {
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: 'Canonical target', finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const body = '<template><link rel="canonical" href="/template"><base href="https://ignored.example/"></template>' +
      '<noscript><base href="https://fallback.example/"></noscript><base href="/catalog/"><link rel="canonical" href="item">'
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })]])
    const result = await collectSearchEvidence({ auditId: 'base', pageUrl: PAGE, renderedHtml: body,
      original: document(body, { headers: { link: '<item>; rel="canonical"' } }), cache, deadline: Date.now() + 10_000 })
    expect(result.canonicalTargets.map(target => target.url)).toEqual([PAGE + 'catalog/item', PAGE + 'item'])
    expect(safeFetchDocument.mock.calls.map(call => call[0])).toEqual([PAGE + 'catalog/item', PAGE + 'item'])
  })

  it('retains an observed challenge response without evaluating it as the requested document', async () => {
    safeFetchDocument.mockResolvedValue({ body: '<title>Just a moment...</title>', finalUrl: PAGE, statusCode: 200,
      headers: { 'cf-mitigated': 'challenge' }, complete: true, redirects: [] })
    const observed = await collectDocument(PAGE, Date.now() + 10_000)
    expect(observed).toMatchObject({ status: 200, body: '<title>Just a moment...</title>', complete: false, reason: 'public_access_challenge' })
  })
  it('shares site-level reads across pages of one execution', async () => {
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: url.endsWith('robots.txt')
      ? 'User-agent: *\nAllow: /\nSitemap: https://example.com/custom.xml'
      : '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.com/</loc></url></urlset>',
      finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const cache = new Map(), input = { auditId: 'one', pageUrl: PAGE, original: document('<title>Example</title>'),
      renderedHtml: '<title>Example</title>', deadline: Date.now() + 10_000, cache }
    const first = await collectSearchEvidence(input)
    await collectSearchEvidence({ ...input, pageUrl: PAGE + 'about' })
    expect(safeFetchDocument).toHaveBeenCalledTimes(2)
    expect(first.sitemapUrls).toEqual([PAGE])
    expect(first.declaredSitemaps).toEqual([PAGE + 'custom.xml'])
  })
  it('only canonical evaluation performs declared-target requests', async () => {
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: '<title>Target</title>', finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })]])
    const input = { auditId: 'a', pageUrl: PAGE, status: 200, renderedHtml: '<link rel="canonical" href="https://example.com/target">',
      original: document('<title>Page</title>'), cache, deadline: Date.now() + 10_000 }
    const local = await collectSearchEvidence({ ...input, collectCanonicalTargets: false })
    expect(local.canonicalTargets).toEqual([])
    expect(safeFetchDocument).not.toHaveBeenCalled()
    await collectSearchEvidence(input)
    expect(safeFetchDocument).toHaveBeenCalledTimes(1)
  })
  it('sitemap collection reuses the committed robots response', async () => {
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: '<urlset/>', finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    await collectSiteResources(new URL(PAGE).origin, Date.now() + 10_000, document('User-agent: *\nSitemap: https://example.com/custom.xml'))
    expect(safeFetchDocument).toHaveBeenCalledTimes(1)
    expect(safeFetchDocument.mock.calls[0][0]).toBe('https://example.com/custom.xml')
  })
  it('does not treat truncated XML as a missing or valid sitemap', () => {
    expect(parseSitemap(document('<urlset></urlset>', { complete: false }))).toMatchObject({ valid: false, reason: 'sitemap_unavailable' })
  })
  it('rejects entities, HTML, and relative sitemap locations', () => {
    expect(parseSitemap(document('<!DOCTYPE urlset [<!ENTITY x SYSTEM "file:///etc/passwd">]><urlset/>')).valid).toBe(false)
    expect(parseSitemap(document('<html><body>App shell</body></html>')).reason).toBe('not_a_sitemap')
    expect(parseSitemap(document('<urlset><url><loc>/relative</loc></url></urlset>')).reason).toBe('sitemap_invalid_location')
  })
  it('bounds sitemap-index expansion and records incomplete coverage', async () => {
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: url.endsWith('robots.txt') ? 'User-agent: *\nAllow: /'
      : '<sitemapindex>' + Array.from({ length: 8 }, (_, i) => `<sitemap><loc>https://example.com/${i}.xml</loc></sitemap>`).join('') + '</sitemapindex>',
      finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const result = await collectSearchEvidence({ auditId: 'a', pageUrl: PAGE, renderedHtml: '<title>Page</title>', cache: new Map(), deadline: Date.now() + 10_000 })
    expect(result.sitemaps).toHaveLength(SITEMAP_DOCUMENT_LIMIT)
    expect(result.sitemapsComplete).toBe(false)
  })
  it('does not send captured credentials to site-resource or canonical requests', async () => {
    const result = await collectSearchEvidence({ auditId: 'a', pageUrl: PAGE, renderedHtml: '<title>Private</title><link rel="canonical" href="https://other.example/">',
      original: document('<title>Private</title>'), cache: new Map(), deadline: Date.now() + 10_000, privateCapture: true })
    expect(safeFetchDocument).not.toHaveBeenCalled()
    expect(result.public).toBe(false)
    expect(result.rendered.body).toBeNull()
  })
  it('records a public-boundary rejection without raw errors or secrets', async () => {
    safeFetchDocument.mockRejectedValue(new Error('private address or secret'))
    expect(await collectDocument('https://example.com/robots.txt', Date.now() + 5000)).toMatchObject({
      complete: false, body: null, reason: 'public_document_unavailable',
    })
  })
  it('does not fetch after the execution budget is exhausted', async () => {
    expect(await collectDocument(PAGE, Date.now() - 1)).toMatchObject({ complete: false, reason: 'deadline_exhausted' })
    expect(safeFetchDocument).not.toHaveBeenCalled()
  })
})
