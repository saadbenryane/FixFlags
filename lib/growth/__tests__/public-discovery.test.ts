import { describe, expect, it, vi } from 'vitest'
import { discoveryOrigin, inspectPublicDiscovery, inspectPublicResearchWithdrawal } from '../public-discovery'

const origin = 'https://fixflags.com'
const page = (title = 'FixFlags', extra = '') => `<html><head><title>${title}</title>
<meta name="description" content="Public website checks"><link rel="canonical" href="${origin}">
<meta property="og:title" content="FixFlags"><meta property="og:image" content="${origin}/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebSite"}</script>
${extra}</head><body><h1>Look after your website</h1><script>"<h1>not rendered</h1>"</script></body></html>`
const robots = `User-agent: *\nAllow: /\n${['/api', '/admin', '/dashboard', '/sites', '/settings', '/share', '/sign-in', '/sign-up'].map(path => `Disallow: ${path}`).join('\n')}\nSitemap: ${origin}/sitemap.xml`
const xml = (urls = [origin, `${origin}/llms.txt`]) => `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${url}</loc></url>`).join('')}</urlset>`

function transport(overrides: Record<string, Response | Error | string> = {}) {
  const bodies: Record<string, string> = {
    '/': page(), '/robots.txt': robots, '/sitemap.xml': xml(),
    '/llms.txt': `# FixFlags\n\n[Home](${origin}/)`,
  }
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    expect(init).toMatchObject({ redirect: 'manual' })
    expect(init?.headers).not.toHaveProperty('cookie')
    const url = new URL(String(input))
    const value = url.hostname === 'www.fixflags.com'
      ? overrides['www'] ?? new Response('', { status: 308, headers: { location: origin } })
      : overrides[url.pathname] ?? bodies[url.pathname] ?? new Response('missing', { status: 404 })
    if (value instanceof Error) throw value
    if (value instanceof Response) return value.clone()
    return new Response(value, { headers: { 'content-type': url.pathname === '/' ? 'text/html' : 'text/plain' } })
  })
}

const inspect = (overrides: Record<string, Response | Error | string> = {}, requiredPaths = ['/']) => inspectPublicDiscovery({ fetch: transport(overrides), requiredPaths })
const failed = (report: Awaited<ReturnType<typeof inspect>>) => report.checks.filter(check => check.status !== 'pass')

describe('public discovery verification', () => {
  it('checks public crawl eligibility without pretending to verify indexing or browsers', async () => {
    const report = await inspect()
    expect(failed(report)).toEqual([])
    expect(report).toMatchObject({ advertisedUrls: 2, htmlPagesChecked: 1, indexingVerified: false,
      actualCrawlerAccessVerified: false, browserExecuted: false, method: 'public-http-get' })
  })

  it('excludes SVG labels from document title checks and keeps genuine duplicate titles invalid', async () => {
    const graphic = '<svg><title>Flags across five checks</title></svg>'
    expect(failed(await inspect({ '/': page().replace('</body>', graphic + '</body>') }))).toEqual([])
    for (const html of [
      page().replace('<title>FixFlags</title>', '').replace('</body>', graphic + '</body>'),
      page('FixFlags', '<title>Second document title</title>'),
    ]) {
      expect(failed(await inspect({ '/': html }))).toContainEqual({ path: '/', name: 'unique-nonempty-title', status: 'fail' })
    }
  })

  it('marks every page sharing a document title regardless of request order', async () => {
    const guideUrl = `${origin}/guides`
    const overrides = {
      '/guides': new Response(page().replace(`href="${origin}"`, `href="${guideUrl}"`), {
        headers: { 'content-type': 'text/html' },
      }),
      '/sitemap.xml': xml([guideUrl, origin]),
    }
    expect(failed(await inspect(overrides))).toEqual([
      { path: '/', name: 'unique-nonempty-title', status: 'fail' },
      { path: '/guides', name: 'unique-nonempty-title', status: 'fail' },
    ])
  })

  it.each([
    ['noindex', '<meta name="robots" content="noindex,follow">', 'indexable'],
    ['none', '<meta name="googlebot" content="none">', 'indexable'],
    ['canonical', '<link rel="canonical" href="https://example.test/">', 'self-canonical'],
    ['schema', '<script type="application/ld+json">invalid</script>', 'valid-structured-data'],
  ])('fails a 200 page with %s problems', async (_, extra, name) => {
    const report = await inspect({ '/': page('FixFlags', extra) })
    expect(failed(report)).toContainEqual({ path: '/', name, status: 'fail' })
  })

  it('recognizes HTTP header indexing restrictions and HTTP 200 not-found content', async () => {
    const report = await inspect({ '/': new Response(page('Not found'), {
      headers: { 'content-type': 'text/html', 'x-robots-tag': 'noindex' },
    }) })
    expect(failed(report)).toContainEqual({ path: '/', name: 'indexable', status: 'fail' })
  })

  it('detects missing required pages without requiring unapproved research', async () => {
    const report = await inspect({}, ['/', '/pricing'])
    expect(failed(report)).toEqual([{ path: '/sitemap.xml', name: 'required:/pricing', status: 'fail' }])
  })

  it('checks current issue review markup, dates and cross-listing consistency', async () => {
    const path = '/issues/page-http-error'
    const reviewedAt = '2026-10-03T00:00:00.000Z'
    const article = { '@type': 'Article', url: origin + path, dateModified: reviewedAt }
    const dataset = { '@type': 'Dataset', url: origin + path, abstract: 'Controlled fixture limitations',
      temporalCoverage: '2026-10-01T00:00:00.000Z/2026-10-02T00:00:00.000Z',
      measurementTechnique: 'Synthetic observations', variableMeasured: [
        { name: 'siteCount', value: 20 }, { name: 'occurrenceCount', value: 21 }, { name: 'sampleSiteCount', value: 25 },
      ] }
    const html = (route: string, extra = '') => new Response(page(route, extra)
      .replace(`href="${origin}"`, `href="${origin}${route}"`), { headers: { 'content-type': 'text/html' } })
    const marked = (row: object, published = article) => html(path,
      `<script type="application/ld+json">${JSON.stringify({ '@graph': [published, row] })}</script>`)
    const listing = (researchLinks: string) => new Response(`# FixFlags\n[Home](${origin}/)\n${researchLinks}`, {
      headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
    })
    const fixture = {
      '/issues': html('/issues'),
      [path]: marked(dataset),
      '/sitemap.xml': xml([origin, `${origin}/issues`, origin + path]).replace(
        `<loc>${origin}${path}</loc>`, `<loc>${origin}${path}</loc><lastmod>${reviewedAt}</lastmod>`),
      '/llms.txt': listing(`[Library](${origin}/issues)\n[Issue](${origin}${path})`),
    }
    expect(failed(await inspect(fixture))).toEqual([])
    const wrong = await inspect({ ...fixture, [path]: marked({ ...dataset, variableMeasured: dataset.variableMeasured.slice(0, 2) }),
      '/llms.txt': listing(`[Library](${origin}/issues)\n[Stale](/issues/stale)`) })
    expect(failed(wrong)).toEqual([
      { path, name: 'reviewed-issue-markup', status: 'fail' },
      { path: '/llms.txt', name: 'research-links-match-sitemap', status: 'fail' },
    ])
    expect(failed(await inspect({ ...fixture, [path]: marked(dataset, { ...article, dateModified: '2026-10-04T00:00:00Z' }) })))
      .toContainEqual({ path, name: 'reviewed-issue-markup', status: 'fail' })
    expect(failed(await inspect({ ...fixture, '/llms.txt': listing(`[Library](/issues)\n[Issue](${path}?bad=1)`) })))
      .toContainEqual({ path: '/llms.txt', name: 'research-links-match-sitemap', status: 'fail' })
  })

  it('checks explicit research withholding on both listings and the direct library route', async () => {
    const noIndex = page('Library', '<meta name="robots" content="noindex,follow">')
    const llms = (links = '') => new Response(`# FixFlags\n[Home](${origin}/)\n${links}`, {
      headers: { 'content-type': 'text/plain', 'cache-control': 'no-store' },
    })
    const input = { requiredPaths: ['/'], expectNoResearch: true }
    expect(failed(await inspectPublicDiscovery({ ...input, fetch: transport({ '/issues': noIndex, '/llms.txt': llms() }) }))).toEqual([])
    const exposed = await inspectPublicDiscovery({ ...input, fetch: transport({
      '/issues': noIndex.replace('</body>', '<a href="/issues/stale">Stale</a></body>'),
      '/sitemap.xml': xml([origin, `${origin}/issues`]),
      '/llms.txt': llms('[Old issue](/issues/stale)'),
    }) })
    expect(failed(exposed)).toEqual(expect.arrayContaining([
      { path: '/sitemap.xml', name: 'research-withheld', status: 'fail' },
      { path: '/llms.txt', name: 'research-withheld', status: 'fail' },
      { path: '/issues', name: 'research-index-withheld', status: 'fail' },
    ]))
    const staleMarkup = noIndex.replace('</body>', '<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"position":1}]}</script></body>')
    expect(failed(await inspectPublicDiscovery({ ...input, fetch: transport({ '/issues': staleMarkup, '/llms.txt': llms() }) })))
      .toContainEqual({ path: '/issues', name: 'research-index-withheld', status: 'fail' })
    expect(failed(await inspectPublicDiscovery({ ...input, fetch: transport({ '/issues': new Response(staleMarkup, { status: 404 }),
      '/llms.txt': llms() }) }))).toContainEqual({ path: '/issues', name: 'research-index-withheld', status: 'fail' })
  })

  it('checks known withdrawn issue URLs, discovery links and cache policy together', async () => {
    const slug = 'page-http-error'
    const path = '/issues/' + slug
    const response = (body: string, type: string, options: ResponseInit = {}) => new Response(body, {
      ...options, headers: { 'content-type': type, 'cache-control': 'no-store', ...options.headers },
    })
    const withheld = '<meta name="robots" content="noindex"><h1>Page not found</h1>'
    const base = {
      '/issues': response(page('Issue library'), 'text/html'),
      [path]: response(withheld, 'text/html'),
      '/sitemap.xml': response(xml(), 'application/xml'),
      '/llms.txt': response(`# FixFlags\n[Home](${origin}/)`, 'text/plain'),
    }
    const clean = transport(base)
    const inspect = (overrides: Record<string, Response> = {}) =>
      inspectPublicResearchWithdrawal({ issueIds: [slug], fetch: transport({ ...base, ...overrides }) })
    expect((await inspectPublicResearchWithdrawal({ issueIds: [slug], fetch: clean })).checks
      .every(check => check.status === 'pass')).toBe(true)
    expect(clean).toHaveBeenCalledTimes(4)
    expect((await inspect({ [path]: response('Not found', 'text/html', { status: 404 }) })).checks
      .every(check => check.status === 'pass')).toBe(true)
    expect((await inspect({ [path]: response('<title>Not Found</title><meta name="robots" content="noindex">', 'text/html') })).checks
      .every(check => check.status === 'pass')).toBe(true)
    const listed = await inspect({
      '/sitemap.xml': response(xml([origin, origin + path]), 'application/xml', { headers: { 'cache-control': 'public, max-age=0, must-revalidate' } }),
      '/llms.txt': response(`# FixFlags\n[Old study](${path.replace('-', '%2D')})`, 'text/plain', { headers: { 'cdn-cache-control': 'public, max-age=60' } }),
      '/issues': response(page('Issue library', `<script type="application/ld+json">{"@type":"ItemList","itemListElement":[{"url":"${origin + path}"}]}</script>`), 'text/html'),
      [path]: response(withheld + '<script type="application/ld+json">{"@type":"Dataset"}</script>', 'text/html', { headers: { age: '30' } }),
    })
    expect(listed.checks.filter(check => check.status === 'fail')).toEqual(expect.arrayContaining([
      { path, name: 'withdrawn-detail-withheld', status: 'fail' },
      ...['/sitemap.xml', '/llms.txt', '/issues'].map(path => ({ path, name: 'withdrawn-issues-unlisted', status: 'fail' })),
      ...['/sitemap.xml', '/llms.txt', path].map(path => ({ path, name: 'research-no-store', status: 'fail' })),
    ]))
    await expect(inspectPublicResearchWithdrawal({ issueIds: ['../admin'], fetch: clean })).rejects.toThrow('distinct issue slugs')
    expect(clean).toHaveBeenCalledTimes(4)
  })

  it('checks guide entry links, article Analyze links, and the discovery listing without fetching Analyze', async () => {
    const guide = '/guides/website-online-but-not-working'
    const html = (path: string, links: string, head = '') => new Response(page(path, head)
      .replace(`href="${origin}"`, `href="${origin}${path}"`)
      .replace('</body>', links + '</body>'), { headers: { 'content-type': 'text/html' } })
    const fixture = {
      '/': html('/', '<a href="/guides">Website guides</a>'),
      '/guides': html('/guides', `<a href="${guide}">How to check</a>`),
      [guide]: html(guide, '<article><a href="/new" rel="nofollow">Analyze</a></article>'),
      '/sitemap.xml': xml([origin, `${origin}/guides`, `${origin}${guide}`]),
      '/llms.txt': `# FixFlags\n[Guides](${origin}/guides)\n[Check](${origin}${guide})`,
    }
    const request = transport(fixture)
    const input = { requiredPaths: ['/'], guidePaths: [guide] }
    expect(failed(await inspectPublicDiscovery({ ...input, fetch: request }))).toEqual([])
    expect(request.mock.calls.some(([url]) => String(url) === `${origin}/new`)).toBe(false)
    const streamed = `<template id="B:0"></template><div hidden id="S:0"><a href="${guide}">How to check</a></div>`
    const placed = await inspectPublicDiscovery({ ...input, fetch: transport({
      ...fixture, '/guides': html('/guides', streamed + '<script>$RC("B:0","S:0")</script>'),
    }) })
    expect(failed(placed)).toEqual([])
    expect(placed.checks).toContainEqual({ path: '/guides', name: `server-html-link:${guide}`, status: 'pass', delivery: 'streamed' })

    const incomplete = await inspectPublicDiscovery({ ...input, fetch: transport({
      ...fixture,
      '/': html('/', '<a href="/guides">Wrong origin</a>', '<base href="https://other.test/">'),
      '/guides': html('/guides', `${streamed}<template><a href="${guide}">Template</a></template>
        <a href="${guide}" rel="nofollow">Unfollowable</a><a hidden href="${guide}">Hidden</a>`),
      [guide]: html(guide, '<nav><a href="/new">Other Analyze link</a></nav><article><a href="/new?token=private">Altered</a></article>'),
      '/llms.txt': `# FixFlags\n[Guides](${origin}/guides)`,
    }) })
    expect(failed(incomplete)).toEqual(expect.arrayContaining([
      { path: '/', name: 'server-html-link:/guides', status: 'fail' },
      { path: '/guides', name: `server-html-link:${guide}`, status: 'fail' },
      { path: guide, name: 'server-html-link:/new', status: 'fail' },
      { path: '/llms.txt', name: `guide-link:${guide}`, status: 'fail' },
    ]))
    expect(JSON.stringify(incomplete)).not.toMatch(/other\.test|token=private/)
  })

  it('does not fetch private, off-origin, parameterized or malformed advertised URLs', async () => {
    const request = transport({ '/sitemap.xml': xml([origin, `${origin}/sites/private`, 'https://other.test', `${origin}/?secret=private`, 'invalid']) })
    const report = await inspectPublicDiscovery({ fetch: request, requiredPaths: ['/'] })
    expect(failed(report)).toContainEqual({ path: '/sitemap.xml', name: 'public-canonical-urls-only', status: 'fail' })
    expect(request.mock.calls.map(([url]) => String(url))).toEqual(expect.arrayContaining([origin + '/']))
    expect(request.mock.calls.every(([url]) => !String(url).includes('private') && !String(url).includes('other.test'))).toBe(true)
  })

  it('rejects canonical redirects to a different host', async () => {
    const report = await inspect({ www: new Response('', { status: 308, headers: { location: 'https://other.test/' } }) })
    expect(failed(report)).toContainEqual({ path: 'https://www.fixflags.com/', name: 'canonical-redirect', status: 'fail' })
  })

  it('reports a named search crawler denied by robots', async () => {
    const report = await inspect({ '/robots.txt': robots + '\nUser-agent: OAI-SearchBot\nDisallow: /\n' })
    expect(failed(report)).toContainEqual({ path: '/', name: 'crawl-allowed:OAI-SearchBot', status: 'fail' })
  })

  it('does not follow redirects, conceal HTTP failures, or print provider exception text', async () => {
    const redirected = await inspect({ '/': new Response('', { status: 302, headers: { location: 'https://other.test' } }) })
    expect(failed(redirected)).toContainEqual({ path: '/', name: 'http-200', status: 'fail' })
    const unavailable = await inspect({ '/': new Error('private credential value') })
    expect(failed(unavailable)).toContainEqual({ path: '/', name: 'http-response', status: 'unavailable' })
    expect(JSON.stringify(unavailable)).not.toContain('private credential')
  })

  it('fails closed on unavailable, empty, indexed-sitemap and oversized discovery inputs', async () => {
    expect(failed(await inspect({ '/sitemap.xml': new Error('no response') }))).toContainEqual({ path: '/sitemap.xml', name: 'http-response', status: 'unavailable' })
    expect(failed(await inspect({ '/sitemap.xml': xml([]) }))).toContainEqual({ path: '/sitemap.xml', name: 'bounded-nonempty-urlset', status: 'fail' })
    expect(failed(await inspect({ '/sitemap.xml': '<sitemapindex />' }))).toContainEqual({ path: '/sitemap.xml', name: 'urlset', status: 'fail' })
    expect(failed(await inspect({ '/robots.txt': 'x'.repeat(2_000_001) }))).toContainEqual({ path: '/robots.txt', name: 'http-response', status: 'unavailable' })
  })

  it('rejects credentialed origins and unrelated hosts, while accepting loopback fixtures', () => {
    for (const value of ['https://private:secret@fixflags.com', 'https://other.test', 'https://fixflags.com/path', 'file:///etc/passwd']) {
      expect(() => discoveryOrigin(value)).toThrow()
    }
    expect(discoveryOrigin('http://127.0.0.1:3107')).toBe('http://127.0.0.1:3107')
  })
})
