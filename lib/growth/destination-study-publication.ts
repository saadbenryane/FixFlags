import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import type { Element } from 'domhandler'
import robotsParser from 'robots-parser'
import { destinationStudyEdition as study, GUIDE_WITH_STUDY } from '@/lib/marketing/copy/destination-study'
import { getWebsiteGuide } from '@/lib/marketing/copy/guides'
import { discoveryOrigin, indexingDirectives, noIndexDirective, PUBLIC_DISCOVERY_BOTS,
  readDiscoveryBody, readStructuredData, streamedGuideSegments, structuredNodes } from './public-discovery'

export const DESTINATION_STUDY_PATH = `/guides/${GUIDE_WITH_STUDY}`
export const PUBLICATION_ORIGIN = 'https://fixflags.com'
export const DESTINATION_STUDY_RECEIPT_VERSION = 4
const articleSources = [...getWebsiteGuide(GUIDE_WITH_STUDY)!.sources, ...study.sources]
const text = (value: string) => value.replace(/\s+/g, ' ').trim()
const expected = {
  heading: [study.title],
  paragraphs: [study.introduction, ...study.interpretation, `${study.dateLabel} ${study.date}.`],
  caption: [study.caption],
  columns: study.columns,
  rows: study.rows.map(row => [row.label, String(row.status), row.observation]),
  date: [study.date],
  sources: study.sources.map(source => [source.title, source.href]),
}
const digest = (value: typeof expected) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
export const DESTINATION_STUDY_EDITION_SHA256 = digest(expected)
const compact = (value: string) => value.replace(/\s+/g, '')
const editionText = compact([study.title, study.introduction, study.caption, ...study.columns,
  ...expected.rows.flat(), ...study.interpretation, expected.paragraphs.at(-1), ...study.sources.map(source => source.title)].join(''))

function htmlDelivery(html: ReturnType<typeof load>, elements: Element[], segments: Set<string>) {
  let delivery: 'direct' | 'streamed' | 'missing' = 'missing'
  for (const element of elements) {
    const node = html(element)
    if (node.closest('[inert], [aria-hidden="true"]').length) continue
    const hidden = node.parents('[hidden]').add(node.filter('[hidden]')).toArray()
    if (hidden.some(parent => !segments.has(html(parent).attr('id') ?? ''))) continue
    if (!hidden.length) return 'direct'
    delivery = 'streamed'
  }
  return delivery
}

const ANALYZE_PATH = '/new'
const headers = { accept: 'text/html', 'user-agent': 'FixFlagsDiscoveryVerifier/1.0' }

async function inspectAnalyzeForm(request: typeof fetch, origin: string) {
  try {
    const response = await request(origin + ANALYZE_PATH, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers })
    const body = await readDiscoveryBody(response)
    if (response.status !== 200 || !/text\/html/i.test(response.headers.get('content-type') ?? '')) return 'unavailable'
    const html = load(body)
    const segments = streamedGuideSegments(html)
    html('script, style, template, noscript').remove()
    for (const form of html('main form').toArray()) {
      const element = html(form)
      // The Analyze controls start disabled in server HTML until hydration.
      const fields = htmlDelivery(html, element.find('input[name="url"]:not([type="hidden"]):not([readonly]):not([form])').toArray(), segments)
      const submit = htmlDelivery(html, element.find('button[type="submit"]:not([form])').toArray(), segments)
      if (fields !== 'missing' && submit !== 'missing') return fields === 'streamed' || submit === 'streamed' ? 'streamed' : 'direct'
    }
    return 'missing'
  } catch {
    return 'unavailable'
  }
}

async function readDiscoveryResource(request: typeof fetch, url: string, mime: RegExp, accept: string) {
  try {
    const response = await request(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers: { ...headers, accept } })
    const body = await readDiscoveryBody(response)
    return response.status === 200 && mime.test(response.headers.get('content-type') ?? '') ? body : null
  } catch {
    return null
  }
}

async function inspectGuideListings(request: typeof fetch, origin: string, url: string) {
  const sitemapUrl = origin + '/sitemap.xml'
  const robotsUrl = origin + '/robots.txt'
  const [robots, sitemap, llms] = await Promise.all([
    readDiscoveryResource(request, robotsUrl, /^text\/plain\b/i, 'text/plain'),
    readDiscoveryResource(request, sitemapUrl, /^(?:application|text)\/xml\b/i, 'application/xml, text/xml'),
    readDiscoveryResource(request, origin + '/llms.txt', /^text\/plain\b/i, 'text/plain'),
  ])
  const rules = robots === null ? null : robotsParser(robotsUrl, robots)
  const crawlerRules = !rules ? 'unavailable' : !PUBLIC_DISCOVERY_BOTS.every(bot => rules.isAllowed(url, bot) === true)
    ? 'blocked' : !rules.getSitemaps().includes(sitemapUrl) ? 'sitemap-unadvertised' : 'allowed'
  const guideLinks = llms ? [...llms.matchAll(/^[ \t]*- \[[^\]\r\n]+\]\(([^)\r\n]+)\)/gm)].filter(([, href]) => href === url) : []
  const llmsEntry = llms === null ? 'unavailable' as const : /^# FixFlags[ \t]*$/m.test(llms) && guideLinks.length === 1
    ? 'canonical-guide' as const : 'missing-or-ambiguous' as const
  if (sitemap === null) return { crawlerRules, llmsEntry, sitemapEntry: 'unavailable' as const }
  const xml = load(sitemap, { xml: true })
  const entries = xml('urlset > url').filter((_, row) =>
    xml(row).children('loc').toArray().some(loc => xml(loc).text().trim() === url))
  if (xml.root().children('urlset').length !== 1 || entries.length !== 1 || entries.children('loc').length !== 1) {
    return { crawlerRules, llmsEntry, sitemapEntry: 'missing-or-ambiguous' as const }
  }
  const modified = entries.children('lastmod')
  const date = modified.text().trim()
  const matches = modified.length === 1 && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z)?$/.test(date) &&
    Date.parse(date) === Date.parse(study.contentModifiedAt)
  return { crawlerRules, llmsEntry, sitemapEntry: matches ? 'edition-date' as const : 'date-mismatch' as const }
}

export function destinationStudyDiscoveryVerified(discovery?: { analyzeLink: string; analyzeForm: string; indexDirective: string;
  crawlerRules?: string; sitemapEntry?: string; articleMetadata?: string; llmsEntry?: string }) {
  return discovery?.indexDirective === 'no-noindex-observed' &&
    ['direct', 'streamed'].includes(discovery.analyzeLink) && ['direct', 'streamed'].includes(discovery.analyzeForm) &&
    discovery.crawlerRules === 'allowed' && discovery.sitemapEntry === 'edition-date' &&
    discovery.articleMetadata === 'edition-matched' && discovery.llmsEntry === 'canonical-guide'
}

/** Inspect the canonical page and compare rendered study claims, not an embedded approval marker. */
export async function inspectDestinationStudyPublication(input: { origin?: string; fetch?: typeof fetch; now?: Date } = {}) {
  const origin = discoveryOrigin(input.origin ?? PUBLICATION_ORIGIN)
  const url = origin + DESTINATION_STUDY_PATH
  const observedAt = (input.now ?? new Date()).toISOString()
  const receipt = { version: DESTINATION_STUDY_RECEIPT_VERSION, origin, path: DESTINATION_STUDY_PATH, observedAt, method: 'public-http-get' } as const
  try {
    const request = input.fetch ?? fetch
    const response = await request(url, { redirect: 'manual', signal: AbortSignal.timeout(20_000), headers })
    const body = await readDiscoveryBody(response)
    if (response.status !== 200 || !/text\/html/i.test(response.headers.get('content-type') ?? '')) {
      return { ...receipt, state: 'unavailable' as const }
    }
    const html = load(body)
    const canonical = html('link[rel="canonical"]')
    if (canonical.length !== 1 || canonical.attr('href') !== url) return { ...receipt, state: 'canonical-mismatch' as const }
    const articles = structuredNodes(readStructuredData(html)).filter(node => node['@type'] === 'Article' && node.mainEntityOfPage === url)
    const article = articles[0]
    const citation = article?.citation
    const expectedCitations = articleSources.map(source => new URL(source.href, origin).href)
    const articleMetadata = articles.length === 1 && article.dateModified === study.contentModifiedAt &&
      Array.isArray(citation) && citation.every(source => typeof source === 'string') &&
      JSON.stringify(citation.toSorted()) === JSON.stringify(expectedCitations.toSorted())
      ? 'edition-matched' as const : 'missing-or-mismatch' as const
    const indexDirective = noIndexDirective(indexingDirectives(response, html)) ? 'noindex' as const : 'no-noindex-observed' as const
    const segments = streamedGuideSegments(html)
    html('script, style, template, noscript').remove()
    async function inspectDiscovery() {
      const baseHref = html('head base[href]').first().attr('href')
      const base = baseHref && URL.canParse(baseHref, url) ? new URL(baseHref, url).href : url
      const links = html('article a[href]').toArray().filter(element => {
        const anchor = html(element)
        const href = anchor.attr('href')!
        return !anchor.closest('[aria-disabled="true"], [disabled]').length && Boolean(anchor.attr('aria-label')?.trim() || anchor.text().trim()) &&
          URL.canParse(href, base) && new URL(href, base).href === origin + ANALYZE_PATH
      })
      const analyzeLink = htmlDelivery(html, links, segments)
      const [analyzeForm, listings] = await Promise.all([
        analyzeLink === 'missing' ? 'unavailable' as const : inspectAnalyzeForm(request, origin),
        inspectGuideListings(request, origin, url),
      ])
      return { analyzeLink, analyzeForm, indexDirective, articleMetadata, ...listings }
    }
    const section = html(`article section[id="${study.id}"]`)
    if (!section.length) return { ...receipt, state: 'absent' as const, discovery: await inspectDiscovery() }
    const hidden = section.parents('[hidden]').add(section.filter('[hidden]')).toArray()
    if (section.length !== 1 || section.closest('[inert], [aria-hidden="true"]').length ||
      section.find('[hidden], [inert], [aria-hidden="true"]').length ||
      hidden.some(element => !segments.has(html(element).attr('id') ?? ''))) return { ...receipt, state: 'edition-mismatch' as const }
    const table = section.children('table')
    if (table.length !== 1) return { ...receipt, state: 'edition-mismatch' as const }
    const actual = {
      heading: section.children('h2').map((_, element) => text(html(element).text())).get(),
      paragraphs: section.children('p').map((_, element) => text(html(element).text())).get(),
      caption: table.children('caption').map((_, element) => text(html(element).text())).get(),
      columns: table.find('thead th').map((_, element) => text(html(element).text())).get(),
      rows: table.find('tbody tr').toArray().map(row => html(row).children('th, td').map((_, cell) => text(html(cell).text())).get()),
      date: section.find('time').map((_, element) => html(element).attr('datetime') ?? '').get(),
      sources: section.find('a').toArray().map(element => [text(html(element).text()), html(element).attr('href') ?? '']),
    }
    if (compact(section.text()) !== editionText || digest(actual) !== DESTINATION_STUDY_EDITION_SHA256) {
      return { ...receipt, state: 'edition-mismatch' as const }
    }
    return { ...receipt, state: 'edition-match' as const, editionSha256: DESTINATION_STUDY_EDITION_SHA256,
      discovery: await inspectDiscovery() }
  } catch {
    return { ...receipt, state: 'unavailable' as const }
  }
}
