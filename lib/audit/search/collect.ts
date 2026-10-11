import * as cheerio from 'cheerio'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { safeFetchDocument } from '../url'
import type { PublicDocument, SearchPageEvidence } from './contracts'

export const SEARCH_DOCUMENT_LIMIT = 1_000_000
export const SITEMAP_DOCUMENT_LIMIT = 5
export const SITEMAP_URL_LIMIT = 10_000

export type SearchSiteResources = {
  robots: PublicDocument; sitemaps: PublicDocument[]; sitemapUrls: string[];
  complete: boolean; declaredSitemaps: string[];
}
export type SearchResourceCache = Map<string, Promise<SearchSiteResources>>

export function missingDocument(url: string, reason: string): PublicDocument {
  return { url, finalUrl: url, status: null, headers: {}, body: null, complete: false,
    reason, collectedAt: new Date().toISOString(), redirects: [] }
}

export async function collectDocument(url: string, deadline: number, maxBytes = SEARCH_DOCUMENT_LIMIT): Promise<PublicDocument> {
  if (deadline - Date.now() < 100) return missingDocument(url, 'deadline_exhausted')
  try {
    const data = await safeFetchDocument(url, { deadline, timeoutMs: 5000, maxBytes })
    return { url, finalUrl: data.finalUrl, status: data.statusCode, headers: data.headers, body: data.body,
      complete: data.complete, reason: data.complete ? null : 'document_truncated',
      collectedAt: new Date().toISOString(), redirects: data.redirects }
  } catch {
    return missingDocument(url, Date.now() >= deadline ? 'deadline_exhausted' : 'public_document_unavailable')
  }
}

export function parseSitemap(document: PublicDocument): { urls: string[]; children: string[]; valid: boolean; reason: string } {
  if (!document.complete || !document.body || document.status !== 200) return { urls: [], children: [], valid: false, reason: document.reason ?? 'sitemap_unavailable' }
  if (/<!DOCTYPE|<!ENTITY/i.test(document.body) || XMLValidator.validate(document.body) !== true) return { urls: [], children: [], valid: false, reason: 'sitemap_invalid_xml' }
  const parsed = new XMLParser({ processEntities: false, ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true }).parse(document.body) as Record<string, unknown>
  const root = parsed.urlset ?? parsed.sitemapindex
  if (!root || typeof root !== 'object') return { urls: [], children: [], valid: false, reason: 'not_a_sitemap' }
  const entries = (root as Record<string, unknown>)[parsed.urlset ? 'url' : 'sitemap']
  const rows = entries == null ? [] : Array.isArray(entries) ? entries : [entries]
  let invalid = false
  const urls = rows.slice(0, SITEMAP_URL_LIMIT).flatMap(row => {
    const raw = row && typeof row === 'object' ? (row as Record<string, unknown>).loc : undefined
    try {
      if (typeof raw !== 'string') throw new Error('missing loc')
      const url = new URL(raw.trim())
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('invalid loc')
      return [url.toString()]
    } catch { invalid = true; return [] }
  })
  if (rows.length > SITEMAP_URL_LIMIT) return { urls: parsed.urlset ? urls : [], children: parsed.sitemapindex ? urls : [], valid: false, reason: 'sitemap_url_limit' }
  return { urls: parsed.urlset ? urls : [], children: parsed.sitemapindex ? urls : [], valid: !invalid, reason: invalid ? 'sitemap_invalid_location' : 'sitemap_parsed' }
}

export async function collectSiteResources(origin: string, deadline: number, collectedRobots?: PublicDocument): Promise<SearchSiteResources> {
  const robots = collectedRobots ?? await collectDocument(new URL('/robots.txt', origin).toString(), deadline, 512_000)
  const isText = robots.complete && robots.status === 200 && !/<(?:!doctype|html)\b/i.test(robots.body ?? '')
  const declaredSitemaps = isText ? [...new Set((robots.body ?? '').split(/\r?\n/).flatMap(line => {
    const match = line.replace(/#.*$/, '').match(/^\s*sitemap\s*:\s*(\S+)\s*$/i)
    return match ? [match[1]] : []
  }))] : []
  const queue = declaredSitemaps.length ? [...declaredSitemaps] : [new URL('/sitemap.xml', origin).toString()]
  const sitemaps: PublicDocument[] = [], seen = new Set<string>(), sitemapUrls = new Set<string>()
  let complete = true
  while (queue.length && sitemaps.length < SITEMAP_DOCUMENT_LIMIT) {
    const url = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    const document = await collectDocument(url, deadline)
    sitemaps.push(document)
    const parsed = parseSitemap(document)
    if (!parsed.valid && document.status !== 404 && document.status !== 410) complete = false
    parsed.urls.forEach(url => sitemapUrls.add(url))
    for (const child of parsed.children) if (!declaredSitemaps.includes(child)) declaredSitemaps.push(child)
    queue.push(...parsed.children.filter(child => !seen.has(child)))
  }
  if (queue.length) complete = false
  return { robots, sitemaps, sitemapUrls: [...sitemapUrls], complete, declaredSitemaps }
}

export async function collectSearchEvidence(input: {
  auditId: string; pageUrl: string; original?: PublicDocument;
  renderedHtml: string | null; renderedComplete?: boolean; renderedCollectedAt?: string;
  headers?: Record<string, string> | null; finalUrl?: string; status?: number | null;
  deadline: number; cache: SearchResourceCache; privateCapture?: boolean; collectCanonicalTargets?: boolean;
}): Promise<SearchPageEvidence> {
  const collectedAt = new Date().toISOString()
  const origin = new URL(input.pageUrl).origin
  const empty = missingDocument(input.pageUrl, input.privateCapture ? 'private_capture' : 'capture_unavailable')
  const original = input.privateCapture ? empty : input.original ?? empty
  const rendered: PublicDocument = input.privateCapture ? empty : {
    url: input.pageUrl, finalUrl: input.finalUrl ?? input.pageUrl, status: input.status ?? null,
    headers: input.headers ?? {}, body: input.renderedHtml,
    complete: Boolean(input.renderedHtml) && input.renderedComplete !== false && Buffer.byteLength(input.renderedHtml ?? '') <= SEARCH_DOCUMENT_LIMIT,
    reason: input.renderedHtml ? input.renderedComplete === false || Buffer.byteLength(input.renderedHtml) > SEARCH_DOCUMENT_LIMIT ? 'document_truncated' : null : 'capture_unavailable',
    collectedAt: input.renderedCollectedAt ?? collectedAt, redirects: original.redirects,
  }
  if (!input.cache.has(origin)) input.cache.set(origin, input.privateCapture
    ? Promise.resolve({ robots: missingDocument(new URL('/robots.txt', origin).toString(), 'private_capture'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })
    : collectSiteResources(origin, input.deadline))
  const site = await input.cache.get(origin)!
  const canonicalUrls = new Set<string>()
  for (const document of input.collectCanonicalTargets === false ? [] : [original, rendered]) {
    if (!document.complete || !document.body) continue
    const $ = cheerio.load(document.body)
    $('link[rel]').each((_, node) => {
      if (!($(node).attr('rel') ?? '').toLowerCase().split(/\s+/).includes('canonical')) return
      try { canonicalUrls.add(new URL($(node).attr('href') ?? '', document.finalUrl).toString()) } catch { /* Evaluator records invalid declarations. */ }
    })
    for (const match of (document.headers.link ?? '').matchAll(/<([^>]+)>\s*;[^,]*?rel\s*=\s*"?canonical"?/gi)) {
      try { canonicalUrls.add(new URL(match[1], document.finalUrl).toString()) } catch { /* Evaluator records invalid declarations. */ }
    }
  }
  const canonicalTargets: PublicDocument[] = []
  for (const url of [...canonicalUrls].slice(0, 3)) {
    if (url === rendered.finalUrl && rendered.complete) canonicalTargets.push(rendered)
    else if (url === original.finalUrl && original.complete) canonicalTargets.push(original)
    else canonicalTargets.push(await collectDocument(url, input.deadline))
  }
  return { auditId: input.auditId, pageUrl: input.pageUrl, collectedAt, public: !input.privateCapture,
    original, rendered, robots: site.robots, sitemaps: site.sitemaps, sitemapUrls: site.sitemapUrls,
    sitemapsComplete: site.complete, declaredSitemaps: site.declaredSitemaps, canonicalTargets }
}
