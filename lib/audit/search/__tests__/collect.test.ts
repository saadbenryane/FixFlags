import { beforeEach, describe, expect, it, vi } from 'vitest'
const safeFetchDocument = vi.hoisted(() => vi.fn())
vi.mock('../../url', () => ({ safeFetchDocument }))
import { collectDocument, collectSearchEvidence, collectSiteResources, parseSitemap, SITEMAP_DOCUMENT_LIMIT } from '../collect'
import { document, PAGE } from './fixtures'
import { evaluateSearch, searchFindings } from '../registry'
import type { RenderedSearchSnapshot } from '../rendered-snapshot'

beforeEach(() => vi.clearAllMocks())
describe('bounded Search resource collection', () => {
  it('fetches one rules file per redirect origin only for crawl collection', async () => {
    const target = 'https://example.net/', targetRobots = target + 'robots.txt'
    const body = 'User-agent: *\nAllow: /'
    const original = document('<title>Destination</title>', { finalUrl: target + 'final', redirects: [PAGE, PAGE + 'alias', target + 'start'] })
    const robots = document(body, { url: PAGE + 'robots.txt', finalUrl: PAGE + 'robots.txt' })
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots, sitemaps: [], sitemapUrls: [], complete: true, declaredSitemaps: [] })]])
    safeFetchDocument.mockResolvedValue({ body, finalUrl: targetRobots, statusCode: 200, headers: {}, complete: true, redirects: [] })
    const input = { auditId: 'a', pageUrl: PAGE, original, renderedHtml: null, cache, deadline: Date.now() + 5000, collectCanonicalTargets: false }
    const evidence = await collectSearchEvidence(input)
    expect(evidence.redirectRobots).toMatchObject([{ url: targetRobots, body }])
    expect(safeFetchDocument).toHaveBeenCalledExactlyOnceWith(targetRobots, expect.objectContaining({ maxBytes: 512_000 }))
    safeFetchDocument.mockClear()
    expect((await collectSearchEvidence({ ...input, collectRedirectRobots: false })).redirectRobots).toEqual([])
    expect(safeFetchDocument).not.toHaveBeenCalled()
  })

  it('does not inspect or follow Search declarations on a sign-in redirect', async () => {
    const login = PAGE + 'login'
    const body = '<title>Sign in to continue</title><meta name="robots" content="noindex">' +
      '<link rel="canonical" href="/html-target"><script type="application/ld+json">invalid</script>'
    const original = document(body, { finalUrl: login, redirects: [PAGE], headers: { link: '</header-target>; rel=canonical' } })
    const section = (html: string) => ({ html, complete: true, reason: null, observed: 1, limit: 10 })
    const snapshot: RenderedSearchSnapshot = { version: 1, contract: 'rendered-search-v1', finalUrl: login,
      documentBaseUrl: login, collectedAt: original.collectedAt, language: 'en', sections: {
        metadata: section(''), indexing: section('<meta name="robots" content="noindex">'),
        canonical: section('<link rel="canonical" href="/rendered-target">'),
        structured: section('<script type="application/ld+json">invalid</script>'), links: section(''),
        text: section('<h1>Sign in to continue</h1>'),
      } }
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *\nAllow: /', { url: PAGE + 'robots.txt' }),
      sitemaps: [], sitemapUrls: [PAGE], complete: true, declaredSitemaps: [] })]])
    safeFetchDocument.mockResolvedValue({ body: '', finalUrl: PAGE, statusCode: 200, headers: {}, complete: true, redirects: [] })
    const input = { auditId: 'sign-in-sources', pageUrl: PAGE, original, renderedHtml: null, renderedSearchSnapshot: snapshot,
      status: 200, finalUrl: login, cache, deadline: Date.now() + 10_000 }
    const result = await collectSearchEvidence(input)
    for (const source of [result.original, result.rendered]) {
      expect(source).toMatchObject({ status: 200, finalUrl: login, complete: false, reason: 'public_sign_in_redirect' })
    }
    expect(result.canonicalTargets).toEqual([])
    expect(safeFetchDocument).not.toHaveBeenCalled()
    const observations = await evaluateSearch(result, null, ['presentation', 'indexing', 'canonical', 'structured-data', 'crawl'])
    expect(observations.find(item => item.checkId === 'title-missing')).toMatchObject({ disposition: 'unknown', reason: 'public_sign_in_redirect' })
    expect(observations.find(item => item.checkId === 'search-crawl-access')).toMatchObject({ disposition: 'passed' })
    expect(searchFindings(observations)).toEqual([])
    const mixed = await collectSearchEvidence({ ...input, original: document('<title>The public page</title>') })
    expect((await evaluateSearch(mixed, null, ['presentation'])).find(item => item.checkId === 'title-missing'))
      .toMatchObject({ disposition: 'passed', source: 'original-html', observed: 'The public page' })
    const moved = await collectSearchEvidence({ ...input, original: undefined, finalUrl: PAGE })
    expect(moved.rendered.searchSnapshot).toBeUndefined()
    expect(moved.canonicalTargets).toEqual([])
    expect(safeFetchDocument).not.toHaveBeenCalled()
  })
  it('retains independently public sources while excluding a credentialed rendered document', async () => {
    const canonical = PAGE + 'public-canonical', privateTarget = PAGE + 'private-canonical?token=PRIVATE_CAPTURE'
    const original = document('<html><head><link rel="canonical" href="' + canonical + '"></head><body><h1>Public page</h1></body></html>')
    safeFetchDocument.mockResolvedValue({ body: '<title>Public canonical</title>', finalUrl: canonical, statusCode: 200,
      headers: { 'content-type': 'text/html' }, complete: true, redirects: [] })
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *\nAllow: /'),
      sitemaps: [], sitemapUrls: [], complete: true, declaredSitemaps: [] })]])
    const result = await collectSearchEvidence({ auditId: 'separate-public-source', pageUrl: PAGE, original,
      renderedHtml: '<title>PRIVATE_RENDERED_TEXT</title><link rel="canonical" href="' + privateTarget + '">',
      headers: { 'x-private-marker': 'PRIVATE_CAPTURE' }, status: 200, finalUrl: privateTarget,
      renderedPrivate: true, cache, deadline: Date.now() + 10_000 })
    expect(result.original).toEqual(original)
    expect(result.public).toBe(true)
    expect(result.rendered).toMatchObject({ body: null, headers: {}, status: null, complete: false, reason: 'private_capture' })
    expect(result.robots.body).toBe('User-agent: *\nAllow: /')
    expect(result.sitemapsComplete).toBe(true)
    expect(result.canonicalTargets).toMatchObject([{ url: canonical, status: 200 }])
    expect(safeFetchDocument).toHaveBeenCalledOnce()
    expect(safeFetchDocument).toHaveBeenCalledWith(canonical, expect.anything())
    expect(JSON.stringify(result)).not.toContain('PRIVATE_')
  })

  it.each([401, 403])('keeps a restricted public HTTP %s response unknown despite a successful private capture', async status => {
    const original = document('<title>Restricted public response</title>', { status })
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *\nAllow: /'),
      sitemaps: [], sitemapUrls: [], complete: true, declaredSitemaps: [] })]])
    const result = await collectSearchEvidence({ auditId: 'restricted-source', pageUrl: PAGE, original, renderedPrivate: true,
      renderedHtml: '<title>PRIVATE_RENDERED_TEXT</title>', status: 200, cache, deadline: Date.now() + 10_000 })
    const observations = await evaluateSearch(result, null, ['presentation', 'indexing', 'canonical'])
    expect(result.original.status).toBe(status)
    expect(result.rendered).toMatchObject({ body: null, status: null, reason: 'private_capture' })
    expect(observations.some(item => item.source === 'original-html')).toBe(true)
    expect(observations.filter(item => item.source === 'original-html' || item.source === 'rendered-dom')
      .every(item => item.disposition === 'unknown')).toBe(true)
    expect(searchFindings(observations)).toEqual([])
    expect(safeFetchDocument).not.toHaveBeenCalled()
  })

  it('requests a canonical target independently of a client-updated rendered URL', async () => {
    const target = PAGE + 'canonical?route=1', body = '<link rel="canonical" href="' + target + '">'
    safeFetchDocument.mockResolvedValue({ body: 'Missing target', finalUrl: target, statusCode: 404, headers: {}, complete: true, redirects: [] })
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })]])
    const result = await collectSearchEvidence({ auditId: 'client-navigation', pageUrl: PAGE, original: document(body),
      renderedHtml: body, finalUrl: target, status: 200, cache, deadline: Date.now() + 10_000 })
    expect(safeFetchDocument).toHaveBeenCalledWith(target, expect.anything())
    expect(result.canonicalTargets).toMatchObject([{ url: target, status: 404 }])
    expect(result.rendered).toMatchObject({ finalUrl: target, status: 200, complete: true })
  })

  it('collects a Link target from public response headers when the body is unavailable', async () => {
    const target = PAGE + 'canonical'
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })]])
    const original = document(null, { reason: 'response_body_unavailable', headers: { link: '</canonical>; rel=canonical' } })
    safeFetchDocument.mockResolvedValue({ body: 'Canonical article', finalUrl: target, statusCode: 200, headers: {}, complete: true, redirects: [] })
    const result = await collectSearchEvidence({ auditId: 'header-only', pageUrl: PAGE, original, renderedHtml: null, cache, deadline: Date.now() + 10_000 })
    expect(result.canonicalTargets).toMatchObject([{ url: target, status: 200 }])
    expect(safeFetchDocument).toHaveBeenCalledExactlyOnceWith(target, expect.anything())
  })

  it.each([PAGE, PAGE + 'redirect-target'])('reuses an actual public response at %s without borrowing rendered response claims', async target => {
    const body = '<link rel="canonical" href="' + target + '">'
    const original = document(body, { finalUrl: target, redirects: target === PAGE ? [] : [PAGE] })
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })]])
    const result = await collectSearchEvidence({ auditId: 'self-canonical', pageUrl: PAGE, original,
      renderedHtml: body, finalUrl: target, status: 200, cache, deadline: Date.now() + 10_000 })
    expect(safeFetchDocument).not.toHaveBeenCalled()
    expect(result.original).toBe(original)
    expect(result.canonicalTargets).toEqual([])
  })

  it('collects active HTML canonical targets against the document base and HTTP declarations against the response URL', async () => {
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: 'Canonical target', finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [] }))
    const body = '<template><link rel="canonical" href="/template"><base href="https://ignored.example/"></template>' +
      '<noscript><base href="https://fallback.example/"></noscript><base href="/catalog/"><link rel="canonical" href="item">'
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })]])
    const link = '</prefix>; rel=canonicalized, </other>; rel=canonical; anchor="/elsewhere", ' +
      '</quoted>; title="rel=canonical"; rel=alternate, </repeated>; rel=alternate; rel=canonical, ' +
      '<item?names=a,b>; title="comma, and \\"quote\\""; REL="alternate CANONICAL"; anchor="/"'
    const result = await collectSearchEvidence({ auditId: 'base', pageUrl: PAGE, renderedHtml: body,
      original: document(body, { headers: { link } }), cache, deadline: Date.now() + 10_000 })
    expect(result.canonicalTargets.map(target => target.url)).toEqual([PAGE + 'catalog/item', PAGE + 'item?names=a,b'])
    expect(safeFetchDocument.mock.calls.map(call => call[0])).toEqual([PAGE + 'catalog/item', PAGE + 'item?names=a,b'])
  })

  it('only follows HTML canonical hints from the head and skips alternate versions', async () => {
    const target = PAGE + 'canonical'
    const body = '<html><head><link rel="canonical" href="/canonical">' +
      '<link rel="canonical" href="/alternate" hreflang="fr"></head>' +
      '<body><link rel="canonical" href="/body"></body></html>'
    const cache = new Map([[new URL(PAGE).origin, Promise.resolve({ robots: document('User-agent: *'), sitemaps: [], sitemapUrls: [], complete: true, declaredSitemaps: [] })]])
    safeFetchDocument.mockImplementation(async (url: string) => ({ body: 'Canonical article', finalUrl: url, statusCode: url === target ? 200 : 404,
      headers: {}, complete: true, redirects: [] }))
    const result = await collectSearchEvidence({ auditId: 'canonical-head', pageUrl: PAGE, original: document(body),
      renderedHtml: body, status: 200, cache, deadline: Date.now() + 10_000 })
    expect(safeFetchDocument).toHaveBeenCalledExactlyOnceWith(target, expect.anything())
    const observations = await evaluateSearch(result, null, ['canonical'])
    expect(observations.filter(item => item.checkId === 'search-canonical-target')).toMatchObject([
      { id: 'search-canonical-target:' + target, disposition: 'passed' },
    ])
    expect(searchFindings(observations)).toEqual([])
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
  it('decodes XML references once while retaining literal CDATA and URL percent escapes', () => {
    const xml = '<urlset><url><loc>https://example.com/catalog?page=1&amp;type=product&#38;lang=fr&#x26;name=&#x1F600;%26</loc></url>' +
      '<url><loc><![CDATA[https://example.com/literal?a=1&amp;b=2]]></loc></url>' +
      '<url><loc>https://example.com/once?a=1&amp;amp;b=2</loc></url></urlset>'
    expect(parseSitemap(document(xml))).toMatchObject({ valid: true, urls: [
      'https://example.com/catalog?page=1&type=product&lang=fr&name=%F0%9F%98%80%26',
      'https://example.com/literal?a=1&amp;b=2',
      'https://example.com/once?a=1&amp;b=2',
    ] })
  })
  it.each([
    '<urlset><sitemap><loc>https://example.com/pages.xml</loc></sitemap></urlset>',
    '<sitemapindex><url><loc>https://example.com/</loc></url></sitemapindex>',
    '<urlset><url><loc>https://example.com/</loc><loc>https://example.com/duplicate</loc></url></urlset>',
    '<urlset><url><loc>https://example.com/<nested/></loc></url></urlset>',
    '<urlset xmlns:x="urn:extension"><url><x:loc>https://example.com/</x:loc></url></urlset>',
    '<urlset><url><loc>https://example.com/#fragment</loc></url></urlset>',
    '<urlset/><sitemapindex/>',
  ])('rejects malformed sitemap structure without inventing locations in %s', body => {
    expect(parseSitemap(document(body))).toMatchObject({ valid: false, urls: [], children: [] })
  })
  it('recognizes protocol namespace aliases without borrowing URLs from extension elements', () => {
    const namespace = 'http://www.sitemaps.org/schemas/sitemap/0.9'
    const body = `<sm:urlset xmlns:sm="${namespace}" xmlns:other="${namespace}" xmlns:x="urn:extension">` +
      '<x:url><x:loc>https://example.com/ignored</x:loc></x:url>' +
      '<other:url><x:loc>https://example.com/ignored</x:loc><sm:loc>https://example.com/</sm:loc>' +
      '<x:details><x:loc>https://example.com/ignored</x:loc></x:details></other:url></sm:urlset>'
    expect(parseSitemap(document(body))).toMatchObject({ valid: true, urls: [PAGE], children: [] })
    expect(parseSitemap(document('<x:urlset xmlns:x="urn:extension"><x:url><x:loc>https://example.com/</x:loc></x:url></x:urlset>')))
      .toMatchObject({ valid: false, urls: [], children: [] })
  })
  it('reads plain-text page URLs with their original path and query semantics', () => {
    const response = document('\uFEFFhttps://example.com/one?a=1&b=2\r\n\r\nhttps://example.com/two%23part\n',
      { headers: { 'content-type': 'text/plain; charset=utf-8' } })
    expect(parseSitemap(response)).toMatchObject({ valid: true, urls: [PAGE + 'one?a=1&b=2', PAGE + 'two%23part'], children: [] })
    expect(parseSitemap({ ...response, body: 'https://example.com/one\nhttps://example.com/two # extra text' }))
      .toMatchObject({ valid: false, reason: 'sitemap_invalid_location', urls: [PAGE + 'one'] })
  })
  it('reads RSS 2.0 and Media RSS page links without mistaking media or feed URLs for pages', () => {
    const body = '<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/"><channel>' +
      '<title>Site feed</title><description>Articles</description><link>https://example.com/feed-home</link>' +
      '<item><title>One</title><link>https://example.com/one?a=1&amp;b=2</link>' +
      '<guid isPermaLink="true">https://example.com/unused</guid><media:content url="https://example.com/video.mp4"/></item>' +
      '<item><title>Two</title><guid>https://example.com/two</guid></item>' +
      '<item><title>Three</title><guid isPermaLink="false">https://example.com/opaque</guid></item></channel></rss>'
    expect(parseSitemap(document(body))).toMatchObject({ valid: true, urls: [PAGE + 'one?a=1&b=2', PAGE + 'two'], children: [] })
  })
  it('reads Atom entry alternate links and ignores feed links, identifiers, and enclosures', () => {
    const body = '<a:feed xmlns:a="http://www.w3.org/2005/Atom" xmlns:x="urn:extension">' +
      '<a:link href="https://example.com/feed-home"/><a:entry><a:id>https://example.com/opaque</a:id>' +
      '<a:link href="https://example.com/one?a=1&amp;b=2"/><a:link rel="http://www.iana.org/assignments/relation/alternate" href="https://example.com/two"/>' +
      '<a:link rel="self" href="https://example.com/entry.atom"/><a:link rel="enclosure" href="https://example.com/audio.mp3"/>' +
      '<x:link href="https://example.com/extension"/></a:entry></a:feed>'
    expect(parseSitemap(document(body))).toMatchObject({ valid: true, urls: [PAGE + 'one?a=1&b=2', PAGE + 'two'], children: [] })
    expect(parseSitemap(document(body.replace('https://example.com/two', '/relative'))))
      .toMatchObject({ valid: false, reason: 'sitemap_invalid_location', urls: [PAGE + 'one?a=1&b=2'] })
  })
  it('keeps a feed with only opaque identifiers out of page membership', () => {
    const body = '<feed xmlns="http://www.w3.org/2005/Atom"><entry><id>https://example.com/opaque</id><content>Inline content</content></entry></feed>'
    expect(parseSitemap(document(body))).toMatchObject({ valid: false, reason: 'sitemap_no_page_locations', urls: [] })
  })
  it('collects declared delegated sitemaps while ignoring an extension child URL', async () => {
    const delegated = 'https://cdn.example.net/index.xml', child = 'https://cdn.example.net/pages.xml'
    safeFetchDocument.mockImplementation(async (url: string) => ({
      body: url === delegated ? '<sitemapindex xmlns:x="urn:extension"><x:sitemap><x:loc>https://example.com/unrelated.xml</x:loc></x:sitemap>' +
        `<sitemap><loc>${child}</loc></sitemap></sitemapindex>` : `<urlset><url><loc>${PAGE}</loc></url></urlset>`,
      finalUrl: url, statusCode: 200, headers: {}, complete: true, redirects: [],
    }))
    const result = await collectSiteResources(PAGE, Date.now() + 5000, document(`Sitemap: ${delegated}`))
    expect(safeFetchDocument.mock.calls.map(call => call[0])).toEqual([delegated, child])
    expect(result).toMatchObject({ complete: true, sitemapUrls: [PAGE], declaredSitemaps: [delegated, child] })
  })
  it('requests the decoded child sitemap URL and retains its real page identities', async () => {
    const child = 'https://example.com/sitemap.xml?page=2&type=product'
    safeFetchDocument.mockImplementation(async (url: string) => ({
      body: url.endsWith('/sitemap.xml')
        ? '<sitemapindex><sitemap><loc>https://example.com/sitemap.xml?page=2&amp;type=product</loc></sitemap></sitemapindex>'
        : url === child ? '<urlset><url><loc>https://example.com/catalog?id=2&amp;lang=en</loc></url></urlset>' : 'Not found',
      finalUrl: url, statusCode: url === child || url.endsWith('/sitemap.xml') ? 200 : 404,
      headers: {}, complete: true, redirects: [],
    }))
    const result = await collectSiteResources('https://example.com', Date.now() + 5000, document('User-agent: *'))
    expect(safeFetchDocument.mock.calls.map(call => call[0])).toEqual(['https://example.com/sitemap.xml', child])
    expect(result).toMatchObject({ complete: true, sitemapUrls: ['https://example.com/catalog?id=2&lang=en'], declaredSitemaps: [child] })
  })
  it('rejects entities, HTML, and relative sitemap locations', () => {
    expect(parseSitemap(document('<!DOCTYPE urlset [<!ENTITY x SYSTEM "file:///etc/passwd">]><urlset/>')).valid).toBe(false)
    expect(parseSitemap(document('<html><body>App shell</body></html>')).reason).toBe('not_a_sitemap')
    expect(parseSitemap(document('<urlset><url><loc>/relative</loc></url></urlset>')).reason).toBe('sitemap_invalid_location')
  })
  it.each(['&custom;', '&#0;', '&#1;', '&#xD800;', '&#xFFFE;', '&#1114112;'])(
    'refuses invalid XML references without silently changing the URL: %s', reference => {
      expect(parseSitemap(document(`<urlset><url><loc>https://example.com/?value=a${reference}b</loc></url></urlset>`)))
        .toMatchObject({ valid: false, reason: 'sitemap_invalid_xml', urls: [] })
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
