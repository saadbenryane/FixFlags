import { load } from 'cheerio'
import robotsParser from 'robots-parser'

export type DiscoveryCheck = {
  path: string
  name: string
  status: 'pass' | 'fail' | 'unavailable'
}
export type DiscoveryReport = {
  version: 1
  origin: string
  observedAt: string
  method: 'public-http-get'
  browserExecuted: false
  indexingVerified: false
  actualCrawlerAccessVerified: false
  advertisedUrls: number
  htmlPagesChecked: number
  checks: DiscoveryCheck[]
  limitations: string[]
}

const BOTS = ['Googlebot', 'bingbot', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot']
const PRIVATE_PATHS = ['/api', '/admin', '/dashboard', '/sites', '/settings', '/share', '/sign-in', '/sign-up']
const MAX_URLS = 200
const MAX_BYTES = 2_000_000

function normalizedUrl(value: string): string {
  const url = new URL(value)
  if (url.pathname === '/') url.pathname = ''
  return url.href.replace(/\/$/, '')
}

/** Only audits the public FixFlags origin or an explicitly configured loopback fixture. */
export function discoveryOrigin(value: string): string {
  const url = new URL(value)
  const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
    (!loopback && (url.protocol !== 'https:' || url.hostname !== 'fixflags.com' || url.port)) ||
    (loopback && !['http:', 'https:'].includes(url.protocol))) throw new Error('Invalid discovery origin')
  return url.origin
}

function eligibleUrl(value: string, origin: string): URL | null {
  try {
    const url = new URL(value)
    if (url.origin !== origin || url.username || url.password || url.search || url.hash ||
      url.pathname.includes('::page:') || PRIVATE_PATHS.some(path => url.pathname === path || url.pathname.startsWith(`${path}/`))) return null
    return url
  } catch { return null }
}

export async function readDiscoveryBody(response: Response): Promise<string> {
  if (!response.body) return ''
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_BYTES) throw new Error('Discovery response exceeds limit')
      text += decoder.decode(chunk.value, { stream: true })
    }
    return text + decoder.decode()
  } finally {
    await reader.cancel().catch(() => {})
    reader.releaseLock()
  }
}

/** No sessions, customer records, submitted analyses, or provider calls are used. */
export async function inspectPublicDiscovery(input: {
  origin?: string
  requiredPaths: readonly string[]
  fetch?: typeof fetch
  now?: Date
}): Promise<DiscoveryReport> {
  const origin = discoveryOrigin(input.origin ?? 'https://fixflags.com')
  const request = input.fetch ?? fetch
  const checks: DiscoveryCheck[] = []
  const check = (path: string, name: string, ok: boolean) => checks.push({ path, name, status: ok ? 'pass' : 'fail' })
  const get = async (url: string) => {
    // Keep redirects manual. An advertised public URL must serve its canonical content directly.
    const response = await request(url, {
      redirect: 'manual', signal: AbortSignal.timeout(20_000),
      headers: { 'user-agent': 'FixFlagsDiscoveryVerifier/1.0', accept: 'text/html,application/xml,text/plain' },
    })
    return { response, body: await readDiscoveryBody(response) }
  }
  const report: DiscoveryReport = {
    version: 1, origin, observedAt: (input.now ?? new Date()).toISOString(), method: 'public-http-get',
    browserExecuted: false, indexingVerified: false, actualCrawlerAccessVerified: false,
    advertisedUrls: 0, htmlPagesChecked: 0, checks,
    limitations: [
      'HTTP metadata and robots directives establish technical eligibility, not indexing, rankings, citations, page speed or conversion.',
      'Crawler directives are inspected locally. Actual crawler requests and edge-policy decisions require independent log or provider evidence.',
      'No customer journey, account, monitoring, repair or provider outcome is exercised by this command.',
    ],
  }
  if (origin === 'https://fixflags.com') {
    try {
      const { response } = await get('https://www.fixflags.com/')
      let destinationMatches = false
      try { destinationMatches = normalizedUrl(response.headers.get('location') ?? '') === normalizedUrl(origin) } catch { /* Invalid redirects fail below. */ }
      check('https://www.fixflags.com/', 'canonical-redirect', [301, 308].includes(response.status) && destinationMatches)
    } catch {
      checks.push({ path: 'https://www.fixflags.com/', name: 'http-response', status: 'unavailable' })
    }
  }
  const resources = await Promise.all(['/robots.txt', '/sitemap.xml', '/llms.txt'].map(async path => {
    try {
      const result = await get(`${origin}${path}`)
      check(path, 'http-200', result.response.status === 200)
      return { path, ...result }
    } catch {
      checks.push({ path, name: 'http-response', status: 'unavailable' })
      return { path, response: null, body: '' }
    }
  }))
  const [robots, sitemap, llms] = resources
  if (!sitemap.response || sitemap.response.status !== 200) return report
  const xml = load(sitemap.body, { xml: true })
  check('/sitemap.xml', 'urlset', xml('urlset').length === 1)
  const advertised = xml('urlset > url > loc').map((_, element) => xml(element).text().trim()).get()
  report.advertisedUrls = advertised.length
  check('/sitemap.xml', 'bounded-nonempty-urlset', advertised.length > 0 && advertised.length <= MAX_URLS)
  check('/sitemap.xml', 'unique-urls', new Set(advertised.map(value => {
    try { return normalizedUrl(value) } catch { return value }
  })).size === advertised.length)
  const urls = advertised.map(value => eligibleUrl(value, origin))
  check('/sitemap.xml', 'public-canonical-urls-only', urls.every(Boolean))
  const safeUrls = [...new Set(urls.filter((url): url is URL => Boolean(url)).map(url => url.href))].slice(0, MAX_URLS)
  for (const path of input.requiredPaths) {
    check('/sitemap.xml', `required:${path}`, safeUrls.some(url => normalizedUrl(url) === normalizedUrl(`${origin}${path}`)))
  }
  const robotRules = robots.response?.status === 200 ? robotsParser(`${origin}/robots.txt`, robots.body) : null
  if (robotRules) {
    check('/robots.txt', 'sitemap-location', robotRules.getSitemaps().includes(`${origin}/sitemap.xml`))
    // Share links use access controls and noindex; robots exclusion would prevent removal recrawls.
    for (const path of PRIVATE_PATHS.filter(path => path !== '/share')) {
      check('/robots.txt', `private-excluded:${path}`, BOTS.every(bot => robotRules.isAllowed(`${origin}${path}`, bot) === false))
    }
  }
  if (llms.response?.status === 200) {
    check('/llms.txt', 'product-identity', /^# FixFlags\s*$/m.test(llms.body))
    const links = [...llms.body.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1])
    check('/llms.txt', 'public-links-only', links.length > 0 && links.every(link => Boolean(eligibleUrl(link, origin))))
  }
  const titles = new Map<string, string>()
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, safeUrls.length) }, async () => {
    while (cursor < safeUrls.length) {
      const url = safeUrls[cursor++]
      const path = new URL(url).pathname
      if (path === '/llms.txt') continue
      if (robotRules) for (const bot of BOTS) check(path, `crawl-allowed:${bot}`, robotRules.isAllowed(url, bot) === true)
      try {
        const { response, body } = await get(url)
        report.htmlPagesChecked++
        check(path, 'http-200', response.status === 200)
        if (response.status !== 200) continue
        const html = load(body)
        html('script:not([type="application/ld+json"]), style, template').remove()
        check(path, 'html-content-type', /text\/html/i.test(response.headers.get('content-type') ?? ''))
        const title = html('title').text().trim()
        check(path, 'unique-nonempty-title', Boolean(title) && html('title').length === 1 && !titles.has(title))
        if (title) titles.set(title, path)
        check(path, 'description', Boolean(html('meta[name="description"]').attr('content')?.trim()))
        check(path, 'one-nonempty-h1', html('h1').length === 1 && Boolean(html('h1').text().trim()))
        const canonical = html('link[rel="canonical"]').attr('href')
        let matches = false
        try { matches = Boolean(canonical) && normalizedUrl(canonical!) === normalizedUrl(url) } catch { /* Invalid canonical is a failed check. */ }
        check(path, 'self-canonical', html('link[rel="canonical"]').length === 1 && matches)
        const directives = [response.headers.get('x-robots-tag') ?? '', ...html('meta').toArray()
          .filter(element => /^(robots|googlebot|bingbot)$/i.test(html(element).attr('name') ?? ''))
          .map(element => html(element).attr('content') ?? '')].join(',')
        check(path, 'indexable', !/(?:^|[\s,:;])(?:noindex|none)(?:$|[\s,;])/i.test(directives))
        check(path, 'social-preview', Boolean(html('meta[property="og:title"]').attr('content') &&
          html('meta[property="og:image"]').attr('content') && html('meta[name="twitter:card"]').attr('content')))
        const structured = html('script[type="application/ld+json"]').toArray()
        check(path, 'valid-structured-data', structured.length > 0 && structured.every(element => {
          try { const value: unknown = JSON.parse(html(element).text()); return Boolean(value) && typeof value === 'object' } catch { return false }
        }))
      } catch {
        checks.push({ path, name: 'http-response', status: 'unavailable' })
      }
    }
  }))
  checks.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name))
  return report
}
