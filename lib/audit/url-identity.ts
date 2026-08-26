import { classifyCtaHref, isSameSiteOrigin } from '@/lib/audit/flow/link-scoring'
import { normalizeSiteHost } from '@/lib/utils/url-helpers'

const TRACKING_PARAM_EXACT = new Set([
  'gclid',
  'gbraid',
  'wbraid',
  'fbclid',
  'msclkid',
  'ttclid',
  'twclid',
  'dclid',
  'yclid',
  'li_fat_id',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'igshid',
  'si',
  'spm',
  'ref',
  'referrer',
  'fb_action_ids',
])

const TRACKING_PARAM_PREFIXES = ['utm_', 'mtm_', 'hsa_', 'pk_']

const GENERATED_QUERY_PARAMS = new Set([
  'page',
  'p',
  'offset',
  'start',
  'after',
  'before',
  'cursor',
  'per_page',
  'limit',
  'sort',
  'order',
  'orderby',
  'dir',
  'view',
  'filter',
  'filters',
  'facet',
  'facets',
  'color',
  'size',
  'min_price',
  'max_price',
])

const LOCALE_QUERY_PARAMS = new Set(['lang', 'locale', 'hl', 'l'])

const FILE_EXTENSIONS = new Set([
  'pdf',
  'zip',
  'gz',
  'tar',
  'png',
  'jpg',
  'jpeg',
  'gif',
  'webp',
  'svg',
  'ico',
  'css',
  'js',
  'mjs',
  'map',
  'json',
  'xml',
  'csv',
  'mp4',
  'webm',
  'mp3',
  'woff',
  'woff2',
  'ttf',
  'eot',
  'docx',
  'xlsx',
  'pptx',
])

const LOCALE_PATH = /^\/(?:[a-z]{2}|[a-z]{2}-[a-z]{2})(?=\/|$)/i
const PAGINATION_PATH = /\/(?:page|p)\/\d+\/?$/i

export type CanonicalDestination = {
  /** Stable identity key used for deduplication. */
  key: string
  /** Fetchable http(s) URL after identity normalization. */
  url: string
  origin: string
  pathname: string
}

export function isTrackingQueryParam(name: string): boolean {
  const lower = name.toLowerCase()
  if (TRACKING_PARAM_EXACT.has(lower)) return true
  return TRACKING_PARAM_PREFIXES.some((prefix) => lower.startsWith(prefix))
}

export function isGeneratedQueryParam(name: string): boolean {
  return GENERATED_QUERY_PARAMS.has(name.toLowerCase())
}

function stripDefaultPort(parsed: URL): void {
  if (
    (parsed.protocol === 'https:' && parsed.port === '443') ||
    (parsed.protocol === 'http:' && parsed.port === '80')
  ) {
    parsed.port = ''
  }
}

function normalizePathname(pathname: string): string {
  let path = pathname.replace(/\/{2,}/g, '/')
  path = path.replace(LOCALE_PATH, '') || '/'
  path = path.replace(PAGINATION_PATH, '') || '/'
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path || '/'
}

function keepQueryParams(searchParams: URLSearchParams): URLSearchParams {
  const kept = new URLSearchParams()
  const names = [...new Set([...searchParams.keys()])].sort()
  for (const name of names) {
    const lower = name.toLowerCase()
    if (isTrackingQueryParam(lower)) continue
    if (isGeneratedQueryParam(lower)) continue
    if (LOCALE_QUERY_PARAMS.has(lower)) continue
    const values = searchParams.getAll(name).filter((value) => value.length > 0)
    for (const value of values.sort()) kept.append(name, value)
  }
  return kept
}

function isFilePath(pathname: string): boolean {
  const last = pathname.split('/').pop() ?? ''
  const dot = last.lastIndexOf('.')
  if (dot <= 0) return false
  return FILE_EXTENSIONS.has(last.slice(dot + 1).toLowerCase())
}

export function parsePublicHttpUrl(raw: string, base?: string): URL | null {
  try {
    const parsed = new URL(raw, base)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return parsed
  } catch {
    return null
  }
}

/**
 * One deterministic canonical destination for review/open-check identity.
 * Strips hashes, trailing slashes, tracking params, generated pagination/facet
 * params, locale prefixes, and equivalent www/apex hosts.
 */
export function canonicalizeDestination(
  raw: string,
  origin?: string
): CanonicalDestination | null {
  const parsed = parsePublicHttpUrl(raw, origin)
  if (!parsed) return null

  parsed.hash = ''
  parsed.username = ''
  parsed.password = ''
  parsed.hostname = normalizeSiteHost(parsed.hostname.replace(/\.$/, ''))
  stripDefaultPort(parsed)
  parsed.pathname = normalizePathname(parsed.pathname)
  const keptQuery = keepQueryParams(parsed.searchParams).toString()
  parsed.search = keptQuery ? `?${keptQuery}` : ''

  const url = parsed.toString()
  return {
    key: `${parsed.protocol}//${parsed.host}${parsed.pathname}${parsed.search}`,
    url,
    origin: parsed.origin,
    pathname: parsed.pathname,
  }
}

export function canonicalDestinationKey(raw: string, origin?: string): string | null {
  return canonicalizeDestination(raw, origin)?.key ?? null
}

export function sameCanonicalDestination(left: string, right: string): boolean {
  const a = canonicalDestinationKey(left)
  const b = canonicalDestinationKey(right)
  return Boolean(a && b && a === b)
}

export function isHashOnlyHref(href: string): boolean {
  const trimmed = href.trim()
  return trimmed.startsWith('#')
}

/** Customer path label: Home for `/`, otherwise the pathname. */
export function reviewPathLabel(url: string): string {
  try {
    const path = new URL(url).pathname
    if (!path || path === '/') return 'Home'
    return path.length > 1 && path.endsWith('/') ? path.slice(0, -1) : path
  } catch {
    return url
  }
}

export function isEligiblePublicDestination(
  href: string,
  origin: string
): boolean {
  const trimmed = href.trim()
  if (!trimmed || isHashOnlyHref(trimmed)) return false

  const classified = classifyCtaHref(trimmed, { baseUrl: origin })
  if (!classified.isPageNavigation) return false

  const parsed = parsePublicHttpUrl(trimmed, origin)
  if (!parsed) return false
  if (!isSameSiteOrigin(parsed.origin, origin)) return false
  if (isFilePath(parsed.pathname)) return false
  return canonicalizeDestination(parsed.toString(), origin) !== null
}

export type EligibleLink = {
  href: string
  text: string
  canonical: CanonicalDestination
}

export function collectEligibleDestinations(
  origin: string,
  links: Array<{ href: string; text: string }>
): EligibleLink[] {
  const seen = new Set<string>()
  const originKey = canonicalizeDestination(origin)?.key
  const collected: EligibleLink[] = []

  for (const link of links) {
    if (!isEligiblePublicDestination(link.href, origin)) continue
    const canonical = canonicalizeDestination(link.href, origin)
    if (!canonical) continue
    if (originKey && canonical.key === originKey) continue
    if (seen.has(canonical.key)) continue
    seen.add(canonical.key)
    collected.push({
      href: canonical.url,
      text: link.text.trim(),
      canonical,
    })
  }

  return collected
}
