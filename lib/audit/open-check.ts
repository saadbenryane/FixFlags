import { AuditUrlError, safeFetchDocument } from './url'
import { publicResponseRestriction } from './browser/page-capture'
import { publicLinkContext, displayDestination, PUBLIC_LINK_VERIFICATION_RULE } from './checks/destination-evidence'
import { parseActiveHtmlDocument } from './html-document'
import type { EvidenceTarget } from './evidence-targets'
import { PublicRedirectError } from './redirect-evidence'
import { hasMissingPageContent } from './soft-404'
import {
  canonicalizeDestination,
  isEligiblePublicDestination,
  type CanonicalDestination,
} from '@/lib/audit/url-identity'

export const OPEN_CHECK_OUTCOMES = [
  'reachable',
  'redirected',
  'redirect_loop',
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
export type OpenCheckObservation = Pick<OpenCheckResult, 'url' | 'outcome' | 'status' | 'shouldFlagDead'>

export type OpenCheckFetch = (
  input: string,
  init?: { method?: string; redirect?: RequestRedirect; signal?: AbortSignal; headers?: HeadersInit }
) => Promise<Response>

const AUTH_PATH = /\/(login|log-in|signin|sign-in|sign_in|auth|account\/login)(\/|$)/i

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

export function detectSoft404(html: string, status: number | null): boolean {
  if (status !== 200) return false
  const { document: $ } = parseActiveHtmlDocument(html)
  // Error templates, executable strings and SVG accessible names do not
  // establish the page's content. Decode text through the shared HTML parser.
  $('script, style, svg title').remove()
  const headings = $('head > title, h1').toArray().map(element => $(element).text().replace(/\s+/g, ' ').trim())
  const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 2_000)
  return hasMissingPageContent(headings, text)
}

export function classifyPublicGet(input: {
  status: number
  finalUrl: string
  requestedUrl: string
  wwwAuthenticate: string | null
  html: string | null
  cfMitigated: string | null
  httpErrorsOnly?: boolean
}): { outcome: OpenCheckOutcome; shouldFlagDead: boolean; evidence: string } {
  const { status, finalUrl, requestedUrl, wwwAuthenticate, html } = input

  const restriction = publicResponseRestriction({ body: html ?? '', status, headers: { 'cf-mitigated': input.cfMitigated ?? '' } })
  if (restriction === 'bot_challenge')
    return { outcome: 'blocked', shouldFlagDead: false, evidence: 'The destination presented an access challenge; its normal response remains unknown.' }

  if (looksLikeAuth(finalUrl, status, wwwAuthenticate) || looksLikeAuth(requestedUrl, status, wwwAuthenticate)) {
    if (status === 401 || status === 403 || (status >= 200 && status < 300 && AUTH_PATH.test(finalUrl) && !(html && detectSoft404(html, status)))) {
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

  if (restriction === 'rate_limited') {
    return {
      outcome: 'blocked',
      shouldFlagDead: false,
      evidence: `GET ${finalUrl} returned 429.`,
    }
  }

  if (restriction === 'access_denied' && !AUTH_PATH.test(finalUrl)) {
    return {
      outcome: 'blocked',
      shouldFlagDead: false,
      evidence: `GET ${finalUrl} returned 403.`,
    }
  }

  if (status >= 200 && status < 300) {
    if (!input.httpErrorsOnly && html && detectSoft404(html, status)) {
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
  fetchImpl: OpenCheckFetch | undefined,
  url: string,
  timeoutMs: number,
  deadline?: number,
): Promise<{ response: Response; html: string | null } | { error: 'timeout' | 'network' | 'blocked' } |
  { error: 'redirect_loop'; status: number; finalUrl: string }> {
  const remaining = Math.min(timeoutMs, (deadline ?? Infinity) - Date.now())
  if (remaining <= 0) return { error: 'timeout' }
  const { signal, cancel } = abortableTimeout(remaining)
  try {
    if (!fetchImpl) {
      const document = await safeFetchDocument(url, { timeoutMs: remaining, deadline, maxBytes: 20_000 })
      return { response: { status: document.statusCode, url: document.finalUrl,
        headers: new Headers(document.headers) } as Response,
        html: /html/i.test(document.headers['content-type'] ?? '') || !document.headers['content-type'] ? document.body : null }
    }
    // Explicit transport injection is for controlled fixtures. Production always
    // uses the bounded collector and validates each redirect destination.
    const response = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal,
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' } })
    const contentType = response.headers.get('content-type') ?? ''
    const html = contentType.includes('html') || !contentType ? (await response.text()).slice(0, 20_000) : null
    return { response, html }
  } catch (error) {
    if (error instanceof PublicRedirectError && error.reason === 'redirect_loop')
      return { error: 'redirect_loop', status: error.response.statusCode, finalUrl: error.response.finalUrl }
    if (error instanceof AuditUrlError) return { error: 'blocked' }
    const name = error instanceof Error ? error.name : ''
    return { error: signal.aborted || name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network' }
  } finally { cancel() }
}

/** GET response evidence is authoritative. It does not establish an interactive
 * journey, rendered content, or access to an authenticated account. */
export async function openCheckDestination(
  url: string,
  options: { origin?: string; fetchImpl?: OpenCheckFetch; timeoutMs?: number; deadline?: number; httpErrorsOnly?: boolean } = {},
): Promise<OpenCheckResult> {
  const canonical = canonicalizeDestination(url, options.origin)
  let requested: string
  try { requested = new URL(url, options.origin).toString() }
  catch { return finalizeGet(url, canonical, { error: 'blocked' }) }
  const get = await fetchOnce(options.fetchImpl, requested, options.timeoutMs ?? OPEN_CHECK_TIMEOUT_MS, options.deadline)
  return finalizeGet(requested, canonical, get, options.httpErrorsOnly)
}

function finalizeGet(
  requested: string,
  canonical: CanonicalDestination | null,
  get: Awaited<ReturnType<typeof fetchOnce>>,
  httpErrorsOnly = false,
): OpenCheckResult {
  if ('error' in get) {
    if (get.error === 'redirect_loop') return { url: requested, canonicalUrl: canonical?.url ?? requested,
      outcome: 'redirect_loop', status: get.status, finalUrl: get.finalUrl, shouldFlagDead: true,
      evidence: `GET ${displayDestination(requested)} repeated its redirect route without reaching a final page response.` }
    return {
      url: requested,
      canonicalUrl: canonical?.url ?? requested,
      outcome: get.error === 'timeout' ? 'timeout' : get.error === 'blocked' ? 'blocked' : 'unknown',
      status: null,
      finalUrl: null,
      evidence:
        get.error === 'timeout'
          ? `GET ${requested} timed out.`
          : get.error === 'blocked' ? 'Destination was refused by the public-network boundary.' : `GET ${requested} failed before a response.`,
      shouldFlagDead: false,
    }
  }

  const classified = classifyPublicGet({
    status: get.response.status,
    finalUrl: get.response.url || requested,
    requestedUrl: requested,
    wwwAuthenticate: get.response.headers.get('www-authenticate'),
    html: get.html,
    cfMitigated: get.response.headers.get('cf-mitigated'), httpErrorsOnly,
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

export async function openCheckDestinations<T extends OpenCheckObservation = OpenCheckResult>(
  urls: string[],
  options: {
    origin?: string
    fetchImpl?: OpenCheckFetch
    timeoutMs?: number
    ceiling?: number
    concurrency?: number
    deadline?: number
    openDestination?: (...args: Parameters<typeof openCheckDestination>) => Promise<T>
  } = {}
): Promise<{ results: Array<OpenCheckResult | T>; truncated: boolean }> {
  const ceiling = options.ceiling ?? DEFAULT_OPEN_CHECK_CEILING
  const unique: string[] = []
  const seen = new Set<string>()
  for (const url of urls) {
    if (options.origin && !isEligiblePublicDestination(url, options.origin)) continue
    const destination = canonicalizeDestination(url, options.origin)
    const key = destination?.url ?? url
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(key)
  }

  const truncated = unique.length > ceiling
  const batch = unique.slice(0, ceiling)
  const concurrency = Math.max(1, options.concurrency ?? 6)
  const results: Array<OpenCheckResult | T> = []

  for (let i = 0; i < batch.length; i += concurrency) {
    const slice = batch.slice(i, i + concurrency)
    const chunk = await Promise.all(
      slice.map((url) =>
        (options.openDestination ?? openCheckDestination)(url, {
          origin: options.origin,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.timeoutMs,
          deadline: options.deadline,
        })
      )
    )
    results.push(...chunk)
  }

  return { results, truncated }
}

export function deadDestinationFlags(
  results: readonly OpenCheckObservation[],
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
  verificationRule: string
  evidenceTargets: EvidenceTarget[]
}> {
  const dead = results.filter((result) => result.shouldFlagDead)
  if (dead.length === 0) return []

  const evidence = dead
    .slice(0, 8)
    .map((result) => `${displayDestination(result.url)} (${result.outcome}${result.status ? ` ${result.status}` : ''})`)
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
      verificationRule: PUBLIC_LINK_VERIFICATION_RULE,
      evidenceTargets: dead.map(result => ({ kind: 'page', source: 'measured', device: 'desktop',
        label: 'Public link response', context: publicLinkContext(sourceUrl, result.url) })),
    },
  ]
}
