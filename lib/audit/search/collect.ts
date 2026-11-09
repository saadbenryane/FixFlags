import { searchSectionBody, type RenderedSearchSnapshot } from './rendered-snapshot'
import { canonicalDeclarations } from './canonical-declarations'
import { parseActiveHtmlDocument } from '../html-document'
import { parseSitemapXml, parseTextSitemap, sitemapLocation, type SitemapResult } from './sitemap-formats'
import { safeFetchDocument } from '../url'
import { PublicCertificateError, readCertificateFailure } from '../tls-evidence'
import { isPublicChallengeHeader, isSuccessfulPublicGetStatus, PublicResponseBodyError, type PublicHttpDocument } from '../http-evidence'
import { PublicRedirectError } from '../redirect-evidence'
import { isBotInterstitialDocument, isPublicSignInRedirect, PUBLIC_SIGN_IN_REDIRECT } from '../browser/page-capture'
import type { PublicDocument, SearchPageEvidence } from './contracts'
import { SITEMAP_DOCUMENT_LIMIT, SITEMAP_STRUCTURE_VERSION, SITEMAP_URL_LIMIT } from './contracts'
import { searchUrlIdentity } from './resource-identity'
export { SITEMAP_DOCUMENT_LIMIT, SITEMAP_URL_LIMIT } from './contracts'

export const SEARCH_DOCUMENT_LIMIT = 1_000_000

export type SearchSiteResources = {
  robots: PublicDocument; sitemaps: PublicDocument[]; sitemapUrls: string[];
  complete: boolean; declaredSitemaps: string[]; sitemapStructureVersion?: 1 | typeof SITEMAP_STRUCTURE_VERSION;
}
export type SearchResourceCache = Map<string, Promise<SearchSiteResources>>

/** Only the independently fetched public HTTP redirect chain can add crawl targets. */
export function crawlNavigationTargets(pageUrl: string, document: PublicDocument) {
  const page = searchUrlIdentity(pageUrl)
  if (document.reason === PUBLIC_SIGN_IN_REDIRECT || searchUrlIdentity(document.url) !== page ||
    !document.redirects.length || searchUrlIdentity(document.redirects[0]) !== page) return [page]
  const observed = [...document.redirects.slice(1, 5), document.finalUrl].map(searchUrlIdentity)
  return [...new Set([page, ...observed.filter(url => /^https?:\/\//.test(url))])]
}

export function missingDocument(url: string, reason: string): PublicDocument {
  return { url, finalUrl: url, status: null, headers: {}, body: null, complete: false,
    reason, collectedAt: new Date().toISOString(), redirects: [] }
}

export function hasPublicSearchChallenge(document: PublicDocument): boolean {
  return document.reason === 'public_access_challenge' || isPublicChallengeHeader(document.headers['cf-mitigated'])
}

/** A received missing-resource status survives a cut-off body. */
export function isMissingPublicResource(document: PublicDocument): boolean {
  return (document.status === 404 || document.status === 410) && !hasPublicSearchChallenge(document) &&
    (document.complete || document.reason === 'response_body_unavailable' || document.reason === 'document_truncated')
}

/** Headers belong to the observed response even when the body is incomplete. */
export function publicSearchResponseHeaders(document: PublicDocument) {
  if (document.status === null || !isSuccessfulPublicGetStatus(document.status) || hasPublicSearchChallenge(document) ||
    document.reason === PUBLIC_SIGN_IN_REDIRECT) return undefined
  return document.headers
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
  const signIn = !challenge && isPublicSignInRedirect({ requestedUrl: url, finalUrl: data.finalUrl, status: data.statusCode, body: data.body })
  return { url, finalUrl: data.finalUrl, status: data.statusCode, headers: data.headers, body: data.body,
    complete: data.complete && !challenge && !signIn, reason: challenge ? 'public_access_challenge' : signIn ? PUBLIC_SIGN_IN_REDIRECT : redirectFailure ?? (bodyUnavailable ? 'response_body_unavailable'
      : data.complete ? null : 'document_truncated'), collectedAt: new Date().toISOString(), redirects: data.redirects }
}

export function parseSitemap(document: PublicDocument): SitemapResult {
  if (hasPublicSearchChallenge(document)) return { urls: [], children: [], valid: false, reason: 'public_access_challenge' }
  if (!document.complete || !document.body || document.status !== 200) return { urls: [], children: [], valid: false, reason: document.reason ?? 'sitemap_unavailable' }
  const body = document.body.trimStart()
  if (body.startsWith('<')) return parseSitemapXml(document.body)
  const contentType = document.headers['content-type']?.split(';')[0].trim().toLowerCase()
  const pathname = new URL(document.finalUrl).pathname
  const textList = contentType === 'text/plain' || /\.txt(?:\.gz)?$/i.test(pathname) || /^https?:\/\//i.test(body)
  return textList ? parseTextSitemap(body) : parseSitemapXml(document.body)
}

export async function collectSiteResources(origin: string, deadline: number, collectedRobots?: PublicDocument): Promise<SearchSiteResources> {
  const robots = collectedRobots ?? await collectDocument(new URL('/robots.txt', origin).toString(), deadline, 512_000)
  return readSiteSitemaps(origin, robots, url => collectDocument(url, deadline))
}

/** Rebuild older inventory from its retained public documents and exact declaration graph. */
export async function qualifyRecordedSiteResources(origin: string, resources: SearchSiteResources): Promise<SearchSiteResources> {
  if (resources.sitemapStructureVersion === SITEMAP_STRUCTURE_VERSION || !resources.sitemaps.length) return resources
  const documents = new Map(resources.sitemaps.map(document => [document.url, document]))
  return readSiteSitemaps(origin, resources.robots, async url =>
    documents.get(url) ?? missingDocument(url, 'resource_collection_incomplete'))
}

async function readSiteSitemaps(origin: string, robots: PublicDocument, readDocument: (url: string) => Promise<PublicDocument>): Promise<SearchSiteResources> {
  const robotsText = robots.complete && robots.status === 200 && robots.body !== null && !/<(?:!doctype|html)\b/i.test(robots.body)
    ? robots.body : null
  const declared = new Set<string>(), pending: Array<Promise<PublicDocument>> = []
  const sitemaps: PublicDocument[] = [], seen = new Set<string>(), sitemapUrls = new Set<string>()
  // A fallback sitemap can establish membership even when the publisher's
  // declaration inventory could not be read.
  let complete = robotsText !== null || isMissingPublicResource(robots)
  function enqueue(url: string) {
    if (seen.has(url)) return
    seen.add(url)
    if (pending.length >= SITEMAP_DOCUMENT_LIMIT) { complete = false; return }
    const request = readDocument(url)
    // Handle early rejection until the ordered read below reaches this request.
    void request.catch(() => undefined)
    pending.push(request)
  }
  function declare(url: string) {
    if (declared.has(url)) return
    if (declared.size >= SITEMAP_URL_LIMIT) { complete = false; return }
    declared.add(url)
    enqueue(url)
  }
  if (robotsText !== null) for (const line of robotsText.split(/\r?\n/)) {
    const match = line.replace(/#.*$/, '').match(/^\s*sitemap\s*:\s*(.*?)\s*$/i)
    if (!match) continue
    const url = sitemapLocation(match[1])
    if (url) declare(url)
    else complete = false
  }
  if (!pending.length) enqueue(new URL('/sitemap.xml', origin).toString())
  // Known siblings fetch concurrently. Consume them in declaration order so
  // child admission and the shared URL limit stay independent of timing.
  for (const request of pending) {
    const document = await request
    sitemaps.push(document)
    const parsed = parseSitemap(document)
    if (!parsed.valid && (declared.has(document.url) || !isMissingPublicResource(document))) complete = false
    for (const url of parsed.urls) {
      if (sitemapUrls.has(url)) continue
      // The persisted bound applies to the entire execution, not each file.
      // Retain useful positive evidence without claiming a complete inventory.
      if (sitemapUrls.size >= SITEMAP_URL_LIMIT) { complete = false; continue }
      sitemapUrls.add(url)
    }
    for (const child of parsed.children) declare(child)
  }
  return { robots, sitemaps, sitemapUrls: [...sitemapUrls], complete, declaredSitemaps: [...declared], sitemapStructureVersion: SITEMAP_STRUCTURE_VERSION }
}

/** Keep response provenance, while keeping the diverted page out of all Search
 * sections and out of the declared-target collection plan. */
function qualifySearchDocument(document: PublicDocument): PublicDocument {
  const { url, finalUrl, status } = document
  if (document.searchSnapshot && document.searchSnapshot.finalUrl !== finalUrl)
    document = { ...document, searchSnapshot: undefined }
  if (status === null) return document
  const sections = document.searchSnapshot?.sections
  const signIn = document.reason === PUBLIC_SIGN_IN_REDIRECT || isPublicSignInRedirect({
    requestedUrl: url, finalUrl, status, body: document.body, fragments: sections ? [sections.metadata.html, sections.text.html] : undefined,
  })
  return signIn ? { ...document, body: null, headers: {}, searchSnapshot: undefined,
    complete: false, reason: PUBLIC_SIGN_IN_REDIRECT } : document
}

export async function collectSearchEvidence(input: {
  auditId: string; pageUrl: string; original?: PublicDocument;
  collectorVersion?: 1 | 2; renderedHtml: string | null; renderedSearchSnapshot?: RenderedSearchSnapshot; renderedComplete?: boolean; renderedCollectedAt?: string;
  renderedSignInRedirect?: true;
  headers?: Record<string, string> | null; finalUrl?: string; status?: number | null;
  renderedResponseScoped?: boolean;
  deadline: number; cache: SearchResourceCache; privateCapture?: boolean; collectCanonicalTargets?: boolean; collectRedirectRobots?: boolean;
  /** The browser document alone used credentials; other inputs remain public. */
  renderedPrivate?: boolean;
}): Promise<SearchPageEvidence> {
  const collectedAt = new Date().toISOString()
  const origin = new URL(input.pageUrl).origin
  const empty = missingDocument(input.pageUrl, input.privateCapture ? 'private_capture' : 'capture_unavailable')
  const original = input.privateCapture ? empty : qualifySearchDocument(input.original ?? empty)
  const rendered = input.privateCapture ? empty : input.renderedPrivate ? missingDocument(input.pageUrl, 'private_capture') : qualifySearchDocument({
    url: input.pageUrl, finalUrl: input.finalUrl ?? input.pageUrl, status: input.status ?? null,
    headers: input.renderedResponseScoped === false ? {} : input.headers ?? {}, body: input.renderedHtml,
    searchSnapshot: input.renderedSearchSnapshot,
    complete: Boolean(input.renderedHtml) && input.renderedComplete !== false && Buffer.byteLength(input.renderedHtml ?? '') <= SEARCH_DOCUMENT_LIMIT,
    reason: input.renderedSignInRedirect ? PUBLIC_SIGN_IN_REDIRECT
      : input.renderedHtml ? input.renderedComplete === false || Buffer.byteLength(input.renderedHtml) > SEARCH_DOCUMENT_LIMIT ? 'document_truncated' : null : 'capture_unavailable',
    collectedAt: input.renderedCollectedAt ?? collectedAt, redirects: original.redirects,
  })
  if (!input.cache.has(origin)) input.cache.set(origin, input.privateCapture
    ? Promise.resolve({ robots: missingDocument(new URL('/robots.txt', origin).toString(), 'private_capture'), sitemaps: [], sitemapUrls: [], complete: false, declaredSitemaps: [] })
    : collectSiteResources(origin, input.deadline))
  const redirectOrigins = !input.privateCapture && input.collectRedirectRobots !== false
    ? [...new Set(crawlNavigationTargets(input.pageUrl, original).map(url => new URL(url).origin))].filter(target => target !== origin) : []
  const [site, redirectRobots] = await Promise.all([input.cache.get(origin)!,
    Promise.all(redirectOrigins.map(target => collectDocument(new URL('/robots.txt', target).href, input.deadline, 512_000)))])
  const canonicalUrls = new Set<string>()
  for (const document of input.collectCanonicalTargets === false ? [] : [original, rendered]) {
    const body = searchSectionBody(document, 'canonical')
    const parsed = canonicalDeclarations(body === null ? null : parseActiveHtmlDocument(body).document,
      document.finalUrl, document === original ? publicSearchResponseHeaders(document)?.link : undefined)
    for (const declaration of parsed.declarations)
      if (declaration.url) canonicalUrls.add(declaration.url)
  }
  const canonicalTargets: PublicDocument[] = []
  // The evaluator can reuse the original public response at its terminal URL.
  // Keep it in one place. A rendered URL can change without a network request.
  for (const url of [...canonicalUrls].filter(url => !original.complete || url !== original.finalUrl).slice(0, 3))
    canonicalTargets.push(await collectDocument(url, input.deadline))
  return { auditId: input.auditId, pageUrl: input.pageUrl, collectedAt, public: !input.privateCapture, collectorVersion: input.collectorVersion ?? (input.renderedSearchSnapshot ? 2 : 1),
    renderedResponseScoped: input.renderedResponseScoped,
    original, rendered, robots: site.robots, redirectRobots, sitemaps: site.sitemaps, sitemapUrls: site.sitemapUrls,
    sitemapsComplete: site.complete, declaredSitemaps: site.declaredSitemaps, canonicalTargets }
}
