import { describe, expect, it, vi } from 'vitest'
import { discoveryOrigin, inspectPublicDiscovery } from '../public-discovery'

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
