import {
  canonicalizeDestination,
  isEligiblePublicDestination,
  type CanonicalDestination,
} from '@/lib/audit/url-identity'

export const OPEN_CHECK_OUTCOMES = [
  'reachable',
  'redirected',
  'auth_required',
  'not_found',
  'server_error',
  'timeout',
  'blocked',
  'render_error',
  'unknown',
] as const

export type OpenCheckOutcome = (typeof OPEN_CHECK_OUTCOMES)[number]

export type OpenCheckResult = {
  url: string
  canonicalUrl: string
  outcome: OpenCheckOutcome
  status: number | null
  finalUrl: string | null
  evidence: string
  shouldFlagDead: boolean
}

export type OpenCheckFetch = (
  input: string,
  init?: { method?: string; redirect?: RequestRedirect; signal?: AbortSignal; headers?: HeadersInit }
) => Promise<Response>

const AUTH_PATH = /\/(login|log-in|signin|sign-in|sign_in|auth|account\/login)(\/|$)/i
const SOFT_404_PATTERN =
  /page not found|not found|doesn't exist|does not exist|404|no longer available|we couldn't find/i
const TITLE_OR_H1 = /<title[^>]*>([\s\S]*?)<\/title>|<h1[^>]*>([\s\S]*?)<\/h1>/gi

export const DEFAULT_OPEN_CHECK_CEILING = 80
export const OPEN_CHECK_TIMEOUT_MS = 8_000

function abortableTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  }
}

function looksLikeAuth(url: string, status: number | null, wwwAuthenticate: string | null): boolean {
  if (status === 401) return true
  if (wwwAuthenticate) return true
  if (AUTH_PATH.test(url)) return true
  return false
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function detectSoft404(html: string, status: number | null): boolean {
  if (status !== 200) return false
  const text = stripTags(html).slice(0, 2_000)
  const headings: string[] = []
  TITLE_OR_H1.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = TITLE_OR_H1.exec(html))) {
    headings.push(stripTags(match[1] || match[2] || ''))
  }
  const headingHit = headings.some((heading) => SOFT_404_PATTERN.test(heading))
  if (headingHit) return true
  return SOFT_404_PATTERN.test(text.slice(0, 400)) && headings.length > 0
}

function outcomeFromGet(input: {
  status: number
  finalUrl: string
  requestedUrl: string
  wwwAuthenticate: string | null
  html: string | null
}): { outcome: OpenCheckOutcome; shouldFlagDead: boolean; evidence: string } {
  const { status, finalUrl, requestedUrl, wwwAuthenticate, html } = input

  if (looksLikeAuth(finalUrl, status, wwwAuthenticate) || looksLikeAuth(requestedUrl, status, wwwAuthenticate)) {
    if (status === 401 || status === 403 || AUTH_PATH.test(finalUrl)) {
      return {
        outcome: 'auth_required',
        shouldFlagDead: false,
        evidence: `Destination requires sign-in (${status || 'redirect'}).`,
      }
    }
  }

  if (status === 404 || status === 410) {
    return {
      outcome: 'not_found',
      shouldFlagDead: true,
      evidence: `GET ${finalUrl} returned ${status}.`,
    }
  }

  if (status >= 500) {
    return {
      outcome: 'server_error',
      shouldFlagDead: true,
      evidence: `GET ${finalUrl} returned ${status}.`,
    }
  }

  if (status === 429) {
    return {
      outcome: 'blocked',
      shouldFlagDead: false,
      evidence: `GET ${finalUrl} returned 429.`,
    }
  }

  if (status === 403 && !AUTH_PATH.test(finalUrl)) {
    return {
      outcome: 'blocked',
      shouldFlagDead: false,
      evidence: `GET ${finalUrl} returned 403.`,
    }
  }

  if (status >= 200 && status < 300) {
    if (html && detectSoft404(html, status)) {
      return {
        outcome: 'render_error',
        shouldFlagDead: true,
        evidence: `GET ${finalUrl} returned 200 but the page reads as not found.`,
      }
    }
    const redirected = canonicalizeIfPossible(finalUrl) !== canonicalizeIfPossible(requestedUrl)
    return {
      outcome: redirected ? 'redirected' : 'reachable',
      shouldFlagDead: false,
      evidence: redirected
        ? `GET redirected from ${requestedUrl} to ${finalUrl}.`
        : `GET ${finalUrl} returned ${status}.`,
    }
  }

  if (status >= 300 && status < 400) {
    return {
      outcome: 'redirected',
      shouldFlagDead: false,
      evidence: `GET ${requestedUrl} redirected (${status}) to ${finalUrl}.`,
    }
  }

  return {
    outcome: 'unknown',
    shouldFlagDead: false,
    evidence: `GET ${finalUrl} returned ${status}.`,
  }
}

function canonicalizeIfPossible(url: string): string {
  return canonicalizeDestination(url)?.key ?? url
}

async function fetchOnce(
  fetchImpl: OpenCheckFetch,
  url: string,
  method: 'HEAD' | 'GET',
  timeoutMs: number
): Promise<{ response: Response; html: string | null } | { error: 'timeout' | 'network' }> {
  const { signal, cancel } = abortableTimeout(timeoutMs)
  try {
    const response = await fetchImpl(url, {
      method,
      redirect: 'follow',
      signal,
      headers: { Accept: method === 'GET' ? 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' : '*/*' },
    })
    let html: string | null = null
    if (method === 'GET') {
      const contentType = response.headers.get('content-type') ?? ''
      if (contentType.includes('html') || contentType.length === 0) {
        html = (await response.text()).slice(0, 20_000)
      }
    }
    return { response, html }
  } catch (error) {
    const name = error instanceof Error ? error.name : ''
    if (name === 'AbortError' || name === 'TimeoutError') return { error: 'timeout' }
    return { error: 'network' }
  } finally {
    cancel()
  }
}

function headLooksAuthoritativeSuccess(status: number): boolean {
  return status >= 200 && status < 400
}

/**
 * Structured reachability. HEAD is an optional fast path. GET/render is
 * authoritative. Never Flag a destination as dead from HEAD failure alone.
 */
export async function openCheckDestination(
  url: string,
  options: {
    origin?: string
    fetchImpl?: OpenCheckFetch
    timeoutMs?: number
  } = {}
): Promise<OpenCheckResult> {
  const canonical = canonicalizeDestination(url, options.origin)
  const requested = canonical?.url ?? url
  const fetchImpl = options.fetchImpl ?? fetch
  const timeoutMs = options.timeoutMs ?? OPEN_CHECK_TIMEOUT_MS

  const head = await fetchOnce(fetchImpl, requested, 'HEAD', timeoutMs)
  if ('error' in head && head.error === 'timeout') {
    const getAfterHeadTimeout = await fetchOnce(fetchImpl, requested, 'GET', timeoutMs)
    return finalizeGet(requested, canonical, getAfterHeadTimeout)
  }

  if (!('error' in head) && headLooksAuthoritativeSuccess(head.response.status)) {
    const finalUrl = head.response.url || requested
    if (looksLikeAuth(finalUrl, head.response.status, head.response.headers.get('www-authenticate'))) {
      return {
        url: requested,
        canonicalUrl: canonical?.url ?? requested,
        outcome: 'auth_required',
        status: head.response.status,
        finalUrl,
        evidence: `HEAD ${finalUrl} indicates sign-in is required.`,
        shouldFlagDead: false,
      }
    }
    const redirected = canonicalizeIfPossible(finalUrl) !== canonicalizeIfPossible(requested)
    return {
      url: requested,
      canonicalUrl: canonical?.url ?? requested,
      outcome: redirected ? 'redirected' : 'reachable',
      status: head.response.status,
      finalUrl,
      evidence: redirected
        ? `HEAD redirected from ${requested} to ${finalUrl}.`
        : `HEAD ${finalUrl} returned ${head.response.status}.`,
      shouldFlagDead: false,
    }
  }

  const get = await fetchOnce(fetchImpl, requested, 'GET', timeoutMs)
  return finalizeGet(requested, canonical, get)
}

function finalizeGet(
  requested: string,
  canonical: CanonicalDestination | null,
  get: Awaited<ReturnType<typeof fetchOnce>>
): OpenCheckResult {
  if ('error' in get) {
    return {
      url: requested,
      canonicalUrl: canonical?.url ?? requested,
      outcome: get.error === 'timeout' ? 'timeout' : 'unknown',
      status: null,
      finalUrl: null,
      evidence:
        get.error === 'timeout'
          ? `GET ${requested} timed out.`
          : `GET ${requested} failed before a response.`,
      shouldFlagDead: false,
    }
  }

  const classified = outcomeFromGet({
    status: get.response.status,
    finalUrl: get.response.url || requested,
    requestedUrl: requested,
    wwwAuthenticate: get.response.headers.get('www-authenticate'),
    html: get.html,
  })

  return {
    url: requested,
    canonicalUrl: canonical?.url ?? requested,
    outcome: classified.outcome,
    status: get.response.status,
    finalUrl: get.response.url || requested,
    evidence: classified.evidence,
    shouldFlagDead: classified.shouldFlagDead,
  }
}

export async function openCheckDestinations(
  urls: string[],
  options: {
    origin?: string
    fetchImpl?: OpenCheckFetch
    timeoutMs?: number
    ceiling?: number
    concurrency?: number
  } = {}
): Promise<{ results: OpenCheckResult[]; truncated: boolean }> {
  const ceiling = options.ceiling ?? DEFAULT_OPEN_CHECK_CEILING
  const unique: string[] = []
  const seen = new Set<string>()
  for (const url of urls) {
    if (options.origin && !isEligiblePublicDestination(url, options.origin)) continue
    const key = canonicalizeDestination(url, options.origin)?.key ?? url
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(canonicalizeDestination(url, options.origin)?.url ?? url)
  }

  const truncated = unique.length > ceiling
  const batch = unique.slice(0, ceiling)
  const concurrency = Math.max(1, options.concurrency ?? 6)
  const results: OpenCheckResult[] = []

  for (let i = 0; i < batch.length; i += concurrency) {
    const slice = batch.slice(i, i + concurrency)
    const chunk = await Promise.all(
      slice.map((url) =>
        openCheckDestination(url, {
          origin: options.origin,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.timeoutMs,
        })
      )
    )
    results.push(...chunk)
  }

  return { results, truncated }
}

export function deadDestinationFlags(
  results: OpenCheckResult[],
  sourceUrl: string
): Array<{
  checkId: 'broken-internal-links'
  rubric: 'REACH'
  impactTag: 'SEO'
  severity: 'IMPORTANT'
  problem: string
  evidence: string
  fix: string
  confidence: number
  source: 'DETERMINISTIC'
  pageUrl: string
}> {
  const dead = results.filter((result) => result.shouldFlagDead)
  if (dead.length === 0) return []

  const evidence = dead
    .slice(0, 8)
    .map((result) => `${result.canonicalUrl} (${result.outcome}${result.status ? ` ${result.status}` : ''})`)
    .join('; ')

  return [
    {
      checkId: 'broken-internal-links',
      rubric: 'REACH',
      impactTag: 'SEO',
      severity: 'IMPORTANT',
      problem: `${dead.length} public ${dead.length === 1 ? 'link' : 'links'} do not load`,
      evidence,
      fix: '1. Identify the broken public links from the evidence\n2. Update href values to valid routes or correct URLs\n3. Add server-side redirects if the target URL has changed',
      confidence: 1,
      source: 'DETERMINISTIC',
      pageUrl: sourceUrl,
    },
  ]
}
