import { AuditUrlError, safeFetchDocument } from './url'
import { publicResponseRestriction } from './browser/page-capture'
import { publicLinkContext, displayDestination, PUBLIC_LINK_VERIFICATION_RULE } from './checks/destination-evidence'
import { parseActiveHtmlDocument } from './html-document'
import type { EvidenceTarget } from './evidence-targets'
import { PublicRedirectError } from './redirect-evidence'
import { hasMissingPageContent } from './soft-404'
import { isSuccessfulPublicGetStatus, PublicResponseBodyError } from './http-evidence'
import {
  canonicalizeDestination,
  hasAuthenticationPath,
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

/** Access restrictions cannot establish public destination recovery. An auth
 * entry or HTTP-only page check may explicitly accept the sign-in response. */
export function hasSuccessfulPublicGet(
  result: Pick<OpenCheckObservation, 'outcome' | 'status' | 'shouldFlagDead'> | null | undefined,
  options: { allowAuthEntry?: boolean } = {},
): boolean {
  return Boolean(result && !result.shouldFlagDead && result.status !== null && isSuccessfulPublicGetStatus(result.status) &&
    (['reachable', 'redirected'].includes(result.outcome) || options.allowAuthEntry && result.outcome === 'auth_required'))
}

export type OpenCheckFetch = (
  input: string,
  init?: { method?: string; redirect?: RequestRedirect; signal?: AbortSignal; headers?: HeadersInit }
) => Promise<Response>

export const DEFAULT_OPEN_CHECK_CEILING = 80
export const OPEN_CHECK_TIMEOUT_MS = 8_000
const OPEN_CHECK_BODY_LIMIT = 20_000
const REPAIR_BODY_LIMIT = 64_000

function inspectsHtml(contentType: string | null | undefined) {
  return !contentType || /html/i.test(contentType)
}

function abortableTimeout(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(timer),
  }
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
  /** Incomplete required content may establish failure, never success. */
  bodyUnavailable?: boolean
}): { outcome: OpenCheckOutcome; shouldFlagDead: boolean; evidence: string } {
  const { status, finalUrl, requestedUrl, wwwAuthenticate, html } = input

  const restriction = publicResponseRestriction({ body: html ?? '', status, headers: { 'cf-mitigated': input.cfMitigated ?? '' } })
  if (restriction === 'intermediary_authentication_required')
    return { outcome: 'blocked', shouldFlagDead: false, evidence: `HTTP ${status} required proxy or network authentication. The public response remains unknown.` }
  if (restriction === 'bot_challenge')
    return { outcome: 'blocked', shouldFlagDead: false, evidence: 'The destination presented an access challenge; its normal response remains unknown.' }

  const authDestination = hasAuthenticationPath(finalUrl)
  if (status === 401 || wwwAuthenticate || authDestination || hasAuthenticationPath(requestedUrl)) {
    if (status === 401 || status === 403 || (isSuccessfulPublicGetStatus(status) && !input.bodyUnavailable && authDestination && !(html && detectSoft404(html, status)))) {
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

  if (restriction === 'access_denied' && !authDestination) {
    return {
      outcome: 'blocked',
      shouldFlagDead: false,
      evidence: `GET ${finalUrl} returned 403.`,
    }
  }

  if (isSuccessfulPublicGetStatus(status)) {
    if (!input.httpErrorsOnly && html && detectSoft404(html, status)) {
      return {
        outcome: 'render_error',
        shouldFlagDead: true,
        evidence: `GET ${finalUrl} returned 200 but the page reads as not found.`,
      }
    }
    if (input.bodyUnavailable) return { outcome: 'unknown', shouldFlagDead: false,
      evidence: `GET ${displayDestination(requestedUrl)} returned HTTP ${status}, but its response body was incomplete.` }
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
  maxBytes: number,
  deadline?: number,
): Promise<{ response: Response; html: string | null; bodyUnavailable?: boolean } | { error: 'timeout' | 'network' | 'blocked' } |
  { error: 'redirect_loop' | 'redirect_unresolved'; status: number; finalUrl: string }> {
  const remaining = Math.min(timeoutMs, (deadline ?? Infinity) - Date.now())
  if (remaining <= 0) return { error: 'timeout' }
  const { signal, cancel } = abortableTimeout(remaining)
  try {
    if (!fetchImpl) {
      const document = await safeFetchDocument(url, { timeoutMs: remaining, deadline, maxBytes })
      const html = inspectsHtml(document.headers['content-type']) ? document.body : null
      return { response: { status: document.statusCode, url: document.finalUrl,
        headers: new Headers(document.headers) } as Response, html, bodyUnavailable: html !== null && !document.complete }
    }
    // Explicit transport injection is for controlled fixtures. Production always
    // uses the bounded collector and validates each redirect destination.
    const response = await fetchImpl(url, { method: 'GET', redirect: 'follow', signal,
      headers: { Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' } })
    if (!inspectsHtml(response.headers.get('content-type'))) return { response, html: null }
    const html = await response.text()
    if (Buffer.byteLength(html) > maxBytes)
      return { response, html: Buffer.from(html).subarray(0, maxBytes).toString(), bodyUnavailable: true }
    return { response, html }
  } catch (error) {
    if (error instanceof PublicResponseBodyError) {
      const document = error.response
      return { response: { status: document.statusCode, url: document.finalUrl, headers: new Headers(document.headers) } as Response,
        html: inspectsHtml(document.headers['content-type']) ? document.body : null,
        bodyUnavailable: true }
    }
    if (error instanceof PublicRedirectError)
      return { error: error.reason === 'redirect_loop' ? 'redirect_loop' : 'redirect_unresolved',
        status: error.response.statusCode, finalUrl: error.response.finalUrl }
    if (error instanceof AuditUrlError) return { error: 'blocked' }
    const name = error instanceof Error ? error.name : ''
    return { error: signal.aborted || name === 'AbortError' || name === 'TimeoutError' ? 'timeout' : 'network' }
  } finally { cancel() }
}

/** GET response evidence is authoritative. It does not establish an interactive
 * journey, rendered content, or access to an authenticated account. */
export async function openCheckDestination(
  url: string,
  options: { origin?: string; fetchImpl?: OpenCheckFetch; timeoutMs?: number; deadline?: number; httpErrorsOnly?: boolean; extendedBody?: boolean } = {},
): Promise<OpenCheckResult> {
  const canonical = canonicalizeDestination(url, options.origin)
  let requested: string
  try { requested = new URL(url, options.origin).toString() }
  catch { return finalizeGet(url, canonical, { error: 'blocked' }) }
  const maxBytes = options.extendedBody ? REPAIR_BODY_LIMIT : OPEN_CHECK_BODY_LIMIT
  const get = await fetchOnce(options.fetchImpl, requested, options.timeoutMs ?? OPEN_CHECK_TIMEOUT_MS, maxBytes, options.deadline)
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
    if (get.error === 'redirect_unresolved') return { url: requested, canonicalUrl: canonical?.url ?? requested,
      outcome: 'unknown', status: get.status, finalUrl: get.finalUrl, shouldFlagDead: false,
      evidence: `GET ${displayDestination(requested)} returned HTTP ${get.status} without establishing a final page response.` }
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
    cfMitigated: get.response.headers.get('cf-mitigated'), httpErrorsOnly, bodyUnavailable: get.bodyUnavailable,
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

/** Planning and execution share exact request admission and deduplication. */
export function planOpenCheckDestinations(urls: readonly string[], options: { origin?: string; ceiling?: number } = {}) {
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

  return { urls: unique.slice(0, ceiling), truncated: unique.length > ceiling }
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
    extendedBody?: boolean | ReadonlySet<string>
    openDestination?: (...args: Parameters<typeof openCheckDestination>) => Promise<T>
  } = {}
): Promise<{ results: Array<OpenCheckResult | T>; truncated: boolean }> {
  const { urls: batch, truncated } = planOpenCheckDestinations(urls, options)
  const concurrency = Math.max(1, Math.floor(options.concurrency ?? 6))
  const extendedBody = options.extendedBody
  const results: Array<OpenCheckResult | T> = []
  const open = options.openDestination ?? openCheckDestination
  let next = 0
  // A slow destination holds only its own request slot. Store results in
  // admission order so network timing cannot reorder evidence and repair scope.
  await Promise.all(Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
    while (next < batch.length) {
      const index = next++
      const url = batch[index]
      try {
        results[index] = await open(url, {
          origin: options.origin,
          fetchImpl: options.fetchImpl,
          timeoutMs: options.timeoutMs,
          deadline: options.deadline,
          ...(extendedBody === true || typeof extendedBody === 'object' && extendedBody.has(url) ? { extendedBody: true } : {}),
        })
      } catch (error) {
        // Unexpected evaluator or replay errors stop new requests in this batch.
        next = batch.length
        throw error
      }
    }
  }))

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
