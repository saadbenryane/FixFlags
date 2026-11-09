import { load, type CheerioAPI } from 'cheerio'
import robotsParser from 'robots-parser'
import { MIN_PUBLIC_RESEARCH_SITES } from '@/lib/graph/public-research'

export type DiscoveryCheck = {
  path: string
  name: string
  status: 'pass' | 'fail' | 'unavailable'
  delivery?: 'direct' | 'streamed'
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

export const PUBLIC_DISCOVERY_BOTS = ['Googlebot', 'bingbot', 'OAI-SearchBot', 'PerplexityBot', 'Claude-SearchBot'] as const
const PRIVATE_PATHS = ['/api', '/admin', '/dashboard', '/sites', '/settings', '/share', '/sign-in', '/sign-up']
const MAX_URLS = 200
const MAX_BYTES = 2_000_000
const ISSUE_INDEX = '/issues'
const issueDetail = /^\/issues\/[a-z0-9]+(?:-[a-z0-9]+)*$/
const isIssuePath = (path: string) => path === ISSUE_INDEX || path.startsWith(ISSUE_INDEX + '/')

export function noIndexDirective(directives: string) {
  return /(?:^|[\s,:;])(?:noindex|none)(?:$|[\s,;])/i.test(directives)
}

export function indexingDirectives(response: Response, html: CheerioAPI) {
  return [response.headers.get('x-robots-tag') ?? '', ...html('meta').toArray()
    .filter(element => /^(robots|googlebot|bingbot)$/i.test(html(element).attr('name') ?? ''))
    .map(element => html(element).attr('content') ?? '')].join(',')
}

export function structuredNodes(documents: unknown[]): Record<string, unknown>[] {
  return documents.flatMap(value => {
    if (!value || typeof value !== 'object') return []
    const graph = (value as Record<string, unknown>)['@graph']
    const nodes = Array.isArray(value) ? value : Array.isArray(graph) ? graph : [value]
    return nodes.filter(node => node && typeof node === 'object' && !Array.isArray(node))
  })
}

export function readStructuredData(html: CheerioAPI): unknown[] {
  return html('script[type="application/ld+json"]').toArray().map(element => {
    try { return JSON.parse(html(element).text()) as unknown } catch { return null }
  })
}

function hasReviewedIssueMarkup(nodes: Record<string, unknown>[], url: string, lastModified: string | undefined) {
  const datasets = nodes.filter(node => node['@type'] === 'Dataset' && node.url === url)
  const articles = nodes.filter(node => node['@type'] === 'Article' && node.url === url)
  if (datasets.length !== 1 || articles.length !== 1) return false
  const [dataset] = datasets
  const [article] = articles
  const reviewedAt = typeof article.dateModified === 'string' ? Date.parse(article.dateModified) : NaN
  const [start, end, extra] = typeof dataset.temporalCoverage === 'string' ? dataset.temporalCoverage.split('/') : []
  const variables = Array.isArray(dataset.variableMeasured) ? dataset.variableMeasured : []
  function count(name: string) {
    const rows = variables.filter(value => value && value.name === name)
    const value = rows[0]?.value
    return rows.length === 1 && typeof value === 'number' && Number.isSafeInteger(value) ? value : NaN
  }
  const sites = count('siteCount')
  return Boolean(start && end && extra === undefined && Date.parse(start) <= Date.parse(end) && Date.parse(end) <= reviewedAt &&
    reviewedAt === Date.parse(lastModified ?? '') && sites >= MIN_PUBLIC_RESEARCH_SITES &&
    count('sampleSiteCount') >= sites && count('occurrenceCount') >= sites &&
    typeof dataset.abstract === 'string' && dataset.abstract.trim() &&
    typeof dataset.measurementTechnique === 'string' && dataset.measurementTechnique.trim())
}

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

async function readDiscoveryResponse(request: typeof fetch, url: string) {
  const response = await request(url, {
    redirect: 'manual', signal: AbortSignal.timeout(20_000),
    headers: { 'user-agent': 'FixFlagsDiscoveryVerifier/1.0', accept: 'text/html,application/xml,text/plain' },
  })
  return { response, body: await readDiscoveryBody(response) }
}

function hasResearchNoStorePolicy(response: Response) {
  const directivesAllowNoStorage = (header: string) => {
    const directives = header.toLowerCase().split(',').map(value => value.trim())
    return directives.includes('no-store') && !directives.includes('must-understand') && !directives.includes('public')
  }
  const headers = response.headers
  return directivesAllowNoStorage(headers.get('cache-control') ?? '') &&
    ['cdn-cache-control', 'cloudflare-cdn-cache-control', 'surrogate-control'].every(name =>
      !headers.has(name) || directivesAllowNoStorage(headers.get(name)!)) &&
    (!headers.has('age') || /^0+$/.test(headers.get('age')!.trim()))
}

/** Check known retired URLs even after their links have disappeared from discovery. */
export async function inspectPublicResearchWithdrawal(input: {
  issueIds: readonly string[]; origin?: string; fetch?: typeof fetch; now?: Date
}) {
  const origin = discoveryOrigin(input.origin ?? 'https://fixflags.com')
  const paths = new Set(input.issueIds.map(id => `/issues/${id}`))
  if (!paths.size || paths.size > 10 || paths.size !== input.issueIds.length || [...paths].some(path => !issueDetail.test(path))) {
    throw new Error('Supply one to ten distinct issue slugs')
  }
  const checks: DiscoveryCheck[] = []
  const checkedAt = (input.now ?? new Date()).toISOString()
  const request = input.fetch ?? fetch
  const check = (path: string, name: string, ok: boolean) => checks.push({ path, name, status: ok ? 'pass' : 'fail' })
  const linksToWithdrawnIssue = (value: unknown, page: string) => {
    if (typeof value !== 'string') return false
    try {
      const url = new URL(value, origin + page)
      return url.origin === origin && paths.has(decodeURIComponent(url.pathname).replace(/\/$/, ''))
    } catch { return false }
  }
  await Promise.all(['/sitemap.xml', '/llms.txt', ISSUE_INDEX, ...paths].map(async path => {
    try {
      const { response, body } = await readDiscoveryResponse(request, origin + path)
      check(path, 'research-no-store', hasResearchNoStorePolicy(response))
      const type = response.headers.get('content-type') ?? ''
      if (path === '/sitemap.xml') {
        const xml = load(body, { xml: true })
        const locs = xml('urlset > url > loc').map((_, element) => xml(element).text().trim()).get()
        check(path, 'withdrawn-issues-unlisted', response.status === 200 && /^(application|text)\/xml\b/i.test(type) &&
          xml.root().children('urlset').length === 1 && locs.length > 0 && !locs.some(link => linksToWithdrawnIssue(link, path)))
        return
      }
      if (path === '/llms.txt') {
        const links = [...body.matchAll(/\]\(([^\s)]+)\)/g)].map(([, link]) => link)
        check(path, 'withdrawn-issues-unlisted', response.status === 200 && /^text\/plain\b/i.test(type) &&
          /^# FixFlags\s*$/m.test(body) && links.length > 0 && !links.some(link => linksToWithdrawnIssue(link, path)))
        return
      }
      const html = load(body)
      const documents = readStructuredData(html)
      const nodes = structuredNodes(documents)
      const isHtml = /^text\/html\b/i.test(type)
      if (path === ISSUE_INDEX) {
        const indexedLinks = nodes.flatMap(node => Array.isArray(node.itemListElement) ? node.itemListElement.map(item => item?.url) : [])
        const links = html('a[href]').map((_, element) => html(element).attr('href') ?? '').get()
        check(path, 'withdrawn-issues-unlisted', response.status === 200 && isHtml && documents.every(Boolean) &&
          ![...links, ...indexedLinks].some(link => linksToWithdrawnIssue(link, path)))
        return
      }
      const title = html('title').not('svg title')
      const notFoundPage = title.length === 1 && title.text().trim() === 'Not Found' ||
        html('h1').toArray().some(heading => html(heading).text().trim() === 'Page not found')
      const unavailable = [404, 410].includes(response.status) ||
        (response.status === 200 && notFoundPage && noIndexDirective(indexingDirectives(response, html)))
      check(path, 'withdrawn-detail-withheld', unavailable && isHtml && documents.every(Boolean) &&
        !nodes.some(node => node['@type'] === 'Dataset' || node['@type'] === 'Article'))
    } catch {
      checks.push({ path, name: 'http-response', status: 'unavailable' })
    }
  }))
  checks.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name))
  return { version: 1, origin, checkedAt, method: 'public-http-get', checks,
    limitations: ['Observed HTTP responses and cache directives apply to this request path and time. Earlier external copies and other cache locations remain outside this observation.'] }
}

/** Recognize the placement markers in React's completed streamed HTML without executing scripts. */
export function streamedGuideSegments(html: CheerioAPI) {
  const segments = new Set<string>()
  for (const element of html('script:not([src])').toArray()) {
    const script = html(element)
    if (script.attr('type') || script.closest('template, noscript, [hidden], [inert]').length) continue
    for (const [, boundary, segment] of script.text().matchAll(/(?:^|;)\s*\$RC\("(B:[a-z0-9]+)","(S:[a-z0-9]+)"\)(?=\s*(?:;|$))/g)) {
      if (html(`template[id="${boundary}"]`).length === 1 && html(`div[hidden][id="${segment}"]`).length === 1) {
        segments.add(segment)
      }
    }
  }
  return segments
}

/** No sessions, customer records, submitted analyses, or provider calls are used. */
export async function inspectPublicDiscovery(input: {
  origin?: string
  requiredPaths: readonly string[]
  guidePaths?: readonly string[]
  expectNoResearch?: boolean
  fetch?: typeof fetch
  now?: Date
}): Promise<DiscoveryReport> {
  const origin = discoveryOrigin(input.origin ?? 'https://fixflags.com')
  const request = input.fetch ?? fetch
  const checks: DiscoveryCheck[] = []
  const guideIndex = '/guides'
  const guidePaths = input.guidePaths ?? []
  const guideLinks = guidePaths.length ? new Map<string, readonly string[]>([
    ['/', [guideIndex]], [guideIndex, guidePaths], ...guidePaths.map(path => [path, ['/new']] as const),
  ]) : new Map<string, readonly string[]>()
  const observedGuideLinks = new Map<string, Map<string, 'direct' | 'streamed'>>()
  const check = (path: string, name: string, ok: boolean) => checks.push({ path, name, status: ok ? 'pass' : 'fail' })
  const get = (url: string) => readDiscoveryResponse(request, url)
  const report: DiscoveryReport = {
    version: 1, origin, observedAt: (input.now ?? new Date()).toISOString(), method: 'public-http-get',
    browserExecuted: false, indexingVerified: false, actualCrawlerAccessVerified: false,
    advertisedUrls: 0, htmlPagesChecked: 0, checks,
    limitations: [
      'HTTP metadata and robots directives establish technical eligibility, not indexing, rankings, citations, page speed or conversion.',
      'Crawler directives are inspected locally. Actual crawler requests and edge-policy decisions require independent log or provider evidence.',
      ...(guidePaths.length ? ['Guide link delivery labels describe received HTML and recognized stream placement markers only.'] : []),
      'Research checks cover advertised URLs and visible review markup. They do not validate private permission or source records.',
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
  const lastModifiedByUrl = new Map(xml('urlset > url').toArray().map(element =>
    [xml(element).children('loc').text().trim(), xml(element).children('lastmod').text().trim()]))
  report.advertisedUrls = advertised.length
  check('/sitemap.xml', 'bounded-nonempty-urlset', advertised.length > 0 && advertised.length <= MAX_URLS)
  check('/sitemap.xml', 'unique-urls', new Set(advertised.map(value => {
    try { return normalizedUrl(value) } catch { return value }
  })).size === advertised.length)
  const urls = advertised.map(value => eligibleUrl(value, origin))
  check('/sitemap.xml', 'public-canonical-urls-only', urls.every(Boolean))
  const safeUrls = [...new Set(urls.filter((url): url is URL => Boolean(url)).map(url => url.href))].slice(0, MAX_URLS)
  const issuePaths = new Set(urls.flatMap(url => url && isIssuePath(url.pathname) ? [url.pathname] : []))
  if (issuePaths.size) check('/sitemap.xml', 'research-library-and-details',
    issuePaths.has(ISSUE_INDEX) && issuePaths.size > 1 &&
    [...issuePaths].every(path => path === ISSUE_INDEX || issueDetail.test(path)))
  if (input.expectNoResearch) check('/sitemap.xml', 'research-withheld', issuePaths.size === 0)
  for (const path of new Set([...input.requiredPaths, ...guidePaths, ...(guidePaths.length ? [guideIndex] : [])])) {
    check('/sitemap.xml', `required:${path}`, safeUrls.some(url => normalizedUrl(url) === normalizedUrl(`${origin}${path}`)))
  }
  const robotRules = robots.response?.status === 200 ? robotsParser(`${origin}/robots.txt`, robots.body) : null
  if (robotRules) {
    check('/robots.txt', 'sitemap-location', robotRules.getSitemaps().includes(`${origin}/sitemap.xml`))
    // Share links use access controls and noindex; robots exclusion would prevent removal recrawls.
    for (const path of PRIVATE_PATHS.filter(path => path !== '/share')) {
      check('/robots.txt', `private-excluded:${path}`, PUBLIC_DISCOVERY_BOTS.every(bot => robotRules.isAllowed(`${origin}${path}`, bot) === false))
    }
  }
  if (llms.response?.status === 200) {
    check('/llms.txt', 'product-identity', /^# FixFlags\s*$/m.test(llms.body))
    const links = [...llms.body.matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(match => match[1])
    check('/llms.txt', 'public-links-only', links.length > 0 && links.every(link => Boolean(eligibleUrl(link, origin))))
    const llmsIssueUrls = [...llms.body.matchAll(/\]\(([^\s)]+)\)/g)].flatMap(([, link]) => {
      try {
        const url = new URL(link, origin)
        return url.origin === origin && isIssuePath(url.pathname) ? [url] : []
      } catch { return [] }
    })
    const llmsIssuePaths = new Set(llmsIssueUrls.map(url => url.pathname))
    if (issuePaths.size || llmsIssuePaths.size) check('/llms.txt', 'research-links-match-sitemap',
      llmsIssuePaths.has(ISSUE_INDEX) === issuePaths.has(ISSUE_INDEX) &&
      llmsIssueUrls.every(url => !url.search && !url.hash && issuePaths.has(url.pathname)))
    if (issuePaths.size || llmsIssuePaths.size || input.expectNoResearch) {
      check('/llms.txt', 'research-index-no-store', hasResearchNoStorePolicy(llms.response))
    }
    if (input.expectNoResearch) check('/llms.txt', 'research-withheld', llmsIssuePaths.size === 0)
    if (guidePaths.length) {
      for (const path of [guideIndex, ...guidePaths]) {
        check('/llms.txt', `guide-link:${path}`, links.some(link => eligibleUrl(link, origin)?.pathname === path))
      }
    }
  }
  if (input.expectNoResearch) {
    try {
      const { response, body } = await get(`${origin}${ISSUE_INDEX}`)
      const html = load(body)
      const linksToDetails = html('a[href]').toArray().some(element => {
        try {
          const url = new URL(html(element).attr('href') ?? '', origin)
          return url.origin === origin && issueDetail.test(url.pathname)
        } catch { return false }
      })
      const hasPublishedResearch = structuredNodes(readStructuredData(html)).some(node =>
        node['@type'] === 'Dataset' || node['@type'] === 'ItemList' &&
        Array.isArray(node.itemListElement) && node.itemListElement.length > 0)
      check(ISSUE_INDEX, 'research-index-withheld', !linksToDetails && !hasPublishedResearch &&
        ([404, 410].includes(response.status) ||
          (response.status === 200 && noIndexDirective(indexingDirectives(response, html)))))
    } catch {
      checks.push({ path: ISSUE_INDEX, name: 'research-index-withheld', status: 'unavailable' })
    }
  }
  const titles = new Map<string, string[]>()
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(4, safeUrls.length) }, async () => {
    while (cursor < safeUrls.length) {
      const url = safeUrls[cursor++]
      const path = new URL(url).pathname
      if (path === '/llms.txt') continue
      if (robotRules) for (const bot of PUBLIC_DISCOVERY_BOTS) check(path, `crawl-allowed:${bot}`, robotRules.isAllowed(url, bot) === true)
      try {
        const { response, body } = await get(url)
        report.htmlPagesChecked++
        check(path, 'http-200', response.status === 200)
        if (response.status !== 200) continue
        const html = load(body)
        const segments = guideLinks.has(path) ? streamedGuideSegments(html) : new Set<string>()
        html('script:not([type="application/ld+json"]), style, template').remove()
        const isHtml = /text\/html/i.test(response.headers.get('content-type') ?? '')
        check(path, 'html-content-type', isHtml)
        if (isHtml && guideLinks.has(path)) {
          const inArticle = guidePaths.includes(path)
          const base = html('head base[href]').first().attr('href')
          let documentBase = url
          if (base) {
            try { documentBase = new URL(base, url).href } catch { /* Invalid base tags leave the document URL. */ }
          }
          const destinations = new Map<string, 'direct' | 'streamed'>()
          const selector = inArticle ? 'article a[href]' : 'a[href]'
          for (const link of html(selector).toArray()) {
            const anchor = html(link)
            if (anchor.closest('[inert], noscript').length ||
              (!inArticle && /(?:^|\s)nofollow(?:$|\s)/i.test(anchor.attr('rel') ?? ''))) continue
            const hidden = anchor.parents('[hidden]').add(anchor.filter('[hidden]')).toArray()
            if (hidden.some(element => !segments.has(html(element).attr('id') ?? ''))) continue
            try {
              const target = eligibleUrl(new URL(anchor.attr('href') ?? '', documentBase).href, origin)
              if (target && destinations.get(target.pathname) !== 'direct') {
                destinations.set(target.pathname, hidden.length ? 'streamed' : 'direct')
              }
            } catch { /* Unusable links cannot satisfy the required path. */ }
          }
          observedGuideLinks.set(path, destinations)
        }
        // SVG titles label graphics and are independent of the document title.
        const documentTitles = html('title').not('svg title')
        const title = documentTitles.text().trim()
        if (documentTitles.length === 1 && title) {
          const paths = titles.get(title) ?? []
          paths.push(path)
          titles.set(title, paths)
        } else {
          check(path, 'unique-nonempty-title', false)
        }
        check(path, 'description', Boolean(html('meta[name="description"]').attr('content')?.trim()))
        check(path, 'one-nonempty-h1', html('h1').length === 1 && Boolean(html('h1').text().trim()))
        const canonical = html('link[rel="canonical"]').attr('href')
        let matches = false
        try { matches = Boolean(canonical) && normalizedUrl(canonical!) === normalizedUrl(url) } catch { /* Invalid canonical is a failed check. */ }
        check(path, 'self-canonical', html('link[rel="canonical"]').length === 1 && matches)
        check(path, 'indexable', !noIndexDirective(indexingDirectives(response, html)))
        check(path, 'social-preview', Boolean(html('meta[property="og:title"]').attr('content') &&
          html('meta[property="og:image"]').attr('content') && html('meta[name="twitter:card"]').attr('content')))
        const structured = readStructuredData(html)
        check(path, 'valid-structured-data', structured.length > 0 && structured.every(value => Boolean(value) && typeof value === 'object'))
        if (issueDetail.test(path)) check(path, 'reviewed-issue-markup', hasReviewedIssueMarkup(
          structuredNodes(structured), url, lastModifiedByUrl.get(url)))
      } catch {
        checks.push({ path, name: 'http-response', status: 'unavailable' })
      }
    }
  }))
  for (const paths of titles.values()) {
    for (const path of paths) check(path, 'unique-nonempty-title', paths.length === 1)
  }
  for (const [path, targets] of guideLinks) {
    const observed = observedGuideLinks.get(path)
    for (const target of targets) {
      const name = `server-html-link:${target}`
      const delivery = observed?.get(target)
      if (delivery) checks.push({ path, name, status: 'pass', delivery })
      else checks.push({ path, name, status: observed ? 'fail' : 'unavailable' })
    }
  }
  checks.sort((a, b) => a.path.localeCompare(b.path) || a.name.localeCompare(b.name))
  return report
}
