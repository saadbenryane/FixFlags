import { searchSectionBody, type RenderedSearchSnapshot } from './rendered-snapshot'
import * as cheerio from 'cheerio'
import { canonicalDeclarations } from './canonical-declarations'
import { XMLParser, XMLValidator } from 'fast-xml-parser'
import { EntityDecoder } from '@nodable/entities'
import { safeFetchDocument } from '../url'
import { PublicCertificateError, readCertificateFailure } from '../tls-evidence'
import { PublicResponseBodyError, type PublicHttpDocument } from '../http-evidence'
import { PublicRedirectError } from '../redirect-evidence'
import { isBotInterstitialDocument } from '../browser/page-capture'
import type { PublicDocument, SearchPageEvidence } from './contracts'
import { SITEMAP_DOCUMENT_LIMIT, SITEMAP_URL_LIMIT } from './contracts'
export { SITEMAP_DOCUMENT_LIMIT, SITEMAP_URL_LIMIT } from './contracts'

export const SEARCH_DOCUMENT_LIMIT = 1_000_000

class InvalidSitemapReference extends Error {}

/** Decode only XML's predefined and numeric references, exactly once. The
 * parser keeps CDATA separate; DTD declarations are refused before parsing. */
function sitemapEntityDecoder() {
  return new EntityDecoder({
    numericAllowed: true,
    onInputEntity: () => 'throw', onExternalEntity: () => 'throw',
    postCheck: (resolved, original) => {
      if (/&(?!amp;|lt;|gt;|quot;|apos;|#(?:[0-9]+|x[0-9a-fA-F]+);)/.test(original))
        throw new InvalidSitemapReference('Undeclared XML entity')
      for (const match of original.matchAll(/&#(x[0-9a-fA-F]+|[0-9]+);/g)) {
        const code = match[1].startsWith('x') ? parseInt(match[1].slice(1), 16) : Number(match[1])
        if (!(code === 9 || code === 10 || code === 13 || code >= 0x20 && code <= 0xd7ff ||
          code >= 0xe000 && code <= 0xfffd || code >= 0x10000 && code <= 0x10ffff))
          throw new InvalidSitemapReference('Invalid XML character reference')
      }
      return resolved
    },
  })
}

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
  let data: PublicHttpDocument | PublicResponseBodyError['response']
  let bodyUnavailable = false
  let redirectFailure: string | null = null
  try {
    data = await safeFetchDocument(url, { deadline, timeoutMs: 5000, maxBytes, decodeGzip: true })
  } catch (error) {
    if (error instanceof PublicResponseBodyError || error instanceof PublicRedirectError) {
      data = error.response; bodyUnavailable = true
      if (error instanceof PublicRedirectError) redirectFailure = error.reason
    } else {
      const failure = readCertificateFailure(error)
      const failedUrl = error instanceof PublicCertificateError ? error.url : url
      if (failure && new URL(failedUrl).protocol === 'https:') return {
        ...missingDocument(url, 'tls_certificate_refused'), finalUrl: failedUrl,
        redirects: error instanceof PublicCertificateError ? error.redirects : [], transportFailure: failure,
      }
      return missingDocument(url, Date.now() >= deadline ? 'deadline_exhausted' : 'public_document_unavailable')
    }
  }
  const challenge = isBotInterstitialDocument({ body: data.body ?? '', headers: data.headers, status: data.statusCode })
  return { url, finalUrl: data.finalUrl, status: data.statusCode, headers: data.headers, body: data.body,
    complete: data.complete && !challenge, reason: challenge ? 'public_access_challenge' : redirectFailure ?? (bodyUnavailable ? 'response_body_unavailable'
      : data.complete ? null : 'document_truncated'), collectedAt: new Date().toISOString(), redirects: data.redirects }
}

export function parseSitemap(document: PublicDocument): { urls: string[]; children: string[]; valid: boolean; reason: string } {
  if (!document.complete || !document.body || document.status !== 200) return { urls: [], children: [], valid: false, reason: document.reason ?? 'sitemap_unavailable' }
  if (/<!DOCTYPE|<!ENTITY/i.test(document.body) || XMLValidator.validate(document.body) !== true) return { urls: [], children: [], valid: false, reason: 'sitemap_invalid_xml' }
  let parsed: Record<string, unknown>
  try {
    parsed = new XMLParser({ processEntities: true, entityDecoder: sitemapEntityDecoder(),
      ignoreAttributes: false, parseTagValue: false, removeNSPrefix: true }).parse(document.body)
  } catch (error) {
    return { urls: [], children: [], valid: false, reason: error instanceof InvalidSitemapReference
      ? 'sitemap_invalid_xml' : 'sitemap_parse_unavailable' }
  }
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
  const declared = new Set<string>(), queue: string[] = []
  const sitemaps: PublicDocument[] = [], seen = new Set<string>(), sitemapUrls = new Set<string>()
  let complete = true
  function declare(url: string) {
    if (declared.has(url)) return
    if (declared.size >= SITEMAP_URL_LIMIT) { complete = false; return }
    declared.add(url); queue.push(url)
  }
  if (isText) for (const line of (robots.body ?? '').split(/\r?\n/)) {
    const match = line.replace(/#.*$/, '').match(/^\s*sitemap\s*:\s*(\S+)\s*$/i)
    if (match) declare(match[1])
  }
  if (!queue.length) queue.push(new URL('/sitemap.xml', origin).toString())
  while (queue.length && sitemaps.length < SITEMAP_DOCUMENT_LIMIT) {
    const url = queue.shift()!
    if (seen.has(url)) continue
    seen.add(url)
    const document = await collectDocument(url, deadline)
    sitemaps.push(document)
    const parsed = parseSitemap(document)
    if (!parsed.valid && document.status !== 404 && document.status !== 410) complete = false
    for (const url of parsed.urls) {
      if (sitemapUrls.has(url)) continue
      // The persisted bound applies to the entire execution, not each file.
      // Retain useful positive evidence without claiming a complete inventory.
      if (sitemapUrls.size >= SITEMAP_URL_LIMIT) { complete = false; continue }
      sitemapUrls.add(url)
    }
    for (const child of parsed.children) declare(child)
  }
  if (queue.some(url => !seen.has(url))) complete = false
  return { robots, sitemaps, sitemapUrls: [...sitemapUrls], complete, declaredSitemaps: [...declared] }
}

export async function collectSearchEvidence(input: {
  auditId: string; pageUrl: string; original?: PublicDocument;
  collectorVersion?: 1 | 2; renderedHtml: string | null; renderedSearchSnapshot?: RenderedSearchSnapshot; renderedComplete?: boolean; renderedCollectedAt?: string;
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
    searchSnapshot: input.renderedSearchSnapshot,
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
    const body = searchSectionBody(document, 'canonical')
    if (body == null) continue
    const $ = cheerio.load(body)
    for (const declaration of canonicalDeclarations($, document.finalUrl, document === original ? document.headers.link : undefined))
      if (declaration.url) canonicalUrls.add(declaration.url)
  }
  const canonicalTargets: PublicDocument[] = []
  for (const url of [...canonicalUrls].slice(0, 3)) {
    // History API changes can move the rendered URL without requesting it.
    // Only the public transport can supply a reusable target response.
    if (url === original.finalUrl && original.complete) canonicalTargets.push(original)
    else canonicalTargets.push(await collectDocument(url, input.deadline))
  }
  return { auditId: input.auditId, pageUrl: input.pageUrl, collectedAt, public: !input.privateCapture, collectorVersion: input.collectorVersion ?? (input.renderedSearchSnapshot ? 2 : 1),
    original, rendered, robots: site.robots, sitemaps: site.sitemaps, sitemapUrls: site.sitemapUrls,
    sitemapsComplete: site.complete, declaredSitemaps: site.declaredSitemaps, canonicalTargets }
}
