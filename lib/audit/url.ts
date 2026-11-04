import { Resolver } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { addAbortSignal } from 'node:stream'
import { createGunzip } from 'node:zlib'
import { MIMEType } from 'node:util'
import { decodeBuffer } from 'encoding-sniffer'
import type { Agent } from 'undici'
import { publicHttpCapacity } from './progressive/capacity'
import { isPublicIp } from './public-ip'
import { PublicCertificateError, readCertificateFailure } from './tls-evidence'
import { PublicResponseBodyError, type PublicHttpDocument } from './http-evidence'
import { PublicRedirectError, isAutomaticRedirectStatus } from './redirect-evidence'
import { currentExecutionOwnership } from './execution-ownership'
import { parseWebsiteAddress } from '@/lib/utils/website-address'
import { createPublicHttpDispatchers } from './public-http-dispatchers'
export { isPublicIp } from './public-ip'

async function readGzipDocument(input: Buffer, maxBytes: number, signal: AbortSignal) {
  const decoder = addAbortSignal(signal, createGunzip())
  const chunks: Buffer[] = []
  let bytes = 0, complete = true
  decoder.end(input)
  try {
    for await (const chunk of decoder) {
      if (bytes + chunk.length > maxBytes) {
        chunks.push(chunk.subarray(0, maxBytes - bytes))
        complete = false
        break
      }
      bytes += chunk.length; chunks.push(chunk)
    }
    return { bytes: Buffer.concat(chunks), complete }
  } finally { decoder.destroy() }
}

/** Decode collected bytes once, after transport and file decompression. The
 * shared HTML sniffer handles BOM, HTTP, meta and XML declarations without
 * rewriting the source. Undeclared documents retain the existing UTF-8 default. */
function decodeDocument(bytes: Buffer, contentType?: string) {
  let charset: string | undefined
  try { charset = new MIMEType(contentType ?? '').params.get('charset') ?? undefined }
  catch { /* A malformed media type cannot discard otherwise collected evidence. */ }
  return decodeBuffer(bytes, { transportLayerEncodingLabel: charset, defaultEncoding: 'utf-8' })
}

export function isBlockedHostname(hostname: string, allowDevLocalhost = process.env.DEV_ALLOW_LOCALHOST === 'true'): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^\[|\]$/g, '')
  const isLocal =
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  if (isLocal && allowDevLocalhost) return false
  return (
    isLocal ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    (isIP(normalized) !== 0 && !isPublicIp(normalized))
  )
}

type PublicUrlResult = { ok: true; url: string } | { ok: false; error: string }
function normalizePublicUrl(raw: string, navigation: boolean): PublicUrlResult {
  const syntax = parseWebsiteAddress(raw)
  if (!syntax.ok) {
    return { ok: false, error: syntax.reason === 'scheme' ? 'Only public HTTP and HTTPS URLs can be checked'
      : syntax.reason === 'credentials' ? 'URLs containing credentials cannot be checked' : 'Invalid URL format' }
  }
  const parsed = syntax.parsed
  if (isBlockedHostname(parsed.hostname)) {
    return { ok: false, error: 'FixFlags can only check publicly accessible URLs' }
  }
  if (!navigation) parsed.hash = ''
  return { ok: true, url: parsed.toString() }
}

/** HTTP requests address the document without its browser fragment state. */
export function normalizeAuditUrl(raw: string): PublicUrlResult { return normalizePublicUrl(raw, false) }
/** A customer-supplied navigation can select a different rendered application state. */
export function normalizeAuditNavigationUrl(raw: string): PublicUrlResult { return normalizePublicUrl(raw, true) }

/**
 * URL rejected before enqueue (bad format, unresolvable domain, private
 * network). User-correctable: routes surface the message with a 400 instead
 * of the generic 500.
 */
export class AuditUrlError extends Error {
  constructor(message: string, public readonly code: 'UNSAFE_DESTINATION' | 'DNS_NOT_FOUND' | 'DNS_UNAVAILABLE' = 'UNSAFE_DESTINATION') {
    super(message)
    this.name = 'AuditUrlError'
  }
}

export class PublicRequestError extends Error {
  readonly code = 'ETIMEDOUT'
}

const PUBLIC_DNS_TIMEOUT_MS = 5000
const DNS_UNAVAILABLE_MESSAGE = 'Domain lookup is temporarily unavailable. Try again shortly.'

export async function resolvePublicAddresses(hostname: string, signal?: AbortSignal): Promise<string[]> {
  signal?.throwIfAborted()
  hostname = hostname.replace(/^\[|\]$/g, '')
  if (isBlockedHostname(hostname)) {
    throw new AuditUrlError('Destination is not publicly accessible')
  }
  if (isIP(hostname)) return [hostname]

  // Each lookup owns its native queries. A caller stopping cannot cancel
  // another Site's resolver or leave unbounded DNS work behind a rejected wait.
  const resolver = new Resolver({ timeout: PUBLIC_DNS_TIMEOUT_MS, tries: 1 })
  let expired = false
  const cancel = () => resolver.cancel()
  const timer = setTimeout(() => { expired = true; cancel() }, PUBLIC_DNS_TIMEOUT_MS)
  signal?.addEventListener('abort', cancel, { once: true })
  let results: PromiseSettledResult<string[]>[]
  try {
    signal?.throwIfAborted()
    const collect = (query: Promise<string[]>) => query.then(addresses => {
      // One unsafe answer already refuses this destination. Its other family
      // cannot make it eligible, so do not keep that query running.
      if (addresses.some(address => !isPublicIp(address))) cancel()
      return addresses
    })
    results = await Promise.allSettled([collect(resolver.resolve4(hostname)), collect(resolver.resolve6(hostname))])
    signal?.throwIfAborted()
    if (expired) throw new AuditUrlError(DNS_UNAVAILABLE_MESSAGE, 'DNS_UNAVAILABLE')
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', cancel)
  }
  const [v4, v6] = results.map(result => result.status === 'fulfilled' ? result.value : [])
  const addresses = [...v4, ...v6]
  if (addresses.length === 0) {
    const absent = results.every(result => result.status === 'fulfilled' || ['ENOTFOUND', 'ENODATA'].includes(result.reason?.code))
    throw new AuditUrlError(absent ? 'We could not find that domain. Check the URL and try again.' : DNS_UNAVAILABLE_MESSAGE,
      absent ? 'DNS_NOT_FOUND' : 'DNS_UNAVAILABLE')
  }
  if (addresses.some((address) => !isPublicIp(address))) {
    throw new AuditUrlError('Destination resolves to a private or reserved network')
  }
  return addresses
}

// Validate the addresses delivered to the socket, not only an earlier DNS
// answer. Keep the URL hostname for Host, TLS identity and connection reuse.
function createPublicSocketLookup(signal?: AbortSignal): LookupFunction {
  return (hostname, options, callback) => {
    void resolvePublicAddresses(hostname, signal).then(addresses => {
      const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : options.family
      const eligible = family ? addresses.filter(address => isIP(address) === family) : addresses
      if (!eligible.length) throw new AuditUrlError('No public address matches the requested family', 'DNS_NOT_FOUND')
      if (options.all) callback(null, eligible.map(address => ({ address, family: isIP(address) })))
      else callback(null, eligible[0], isIP(eligible[0]))
    }).catch(error => callback(error instanceof Error ? error : new Error('Public address validation failed'), ''))
  }
}
export const publicSocketLookup = createPublicSocketLookup()
const httpDispatchers = createPublicHttpDispatchers(createPublicSocketLookup)

async function assertNormalizedPublicUrl(normalized: PublicUrlResult, signal?: AbortSignal, publicOnly = false): Promise<URL> {
  if (!normalized.ok) throw new AuditUrlError(normalized.error)
  const parsed = new URL(normalized.url)
  if (publicOnly && isBlockedHostname(parsed.hostname, false)) throw new AuditUrlError('Destination is not publicly accessible')
  await resolvePublicAddresses(parsed.hostname, signal)
  return parsed
}

export function assertPublicAuditUrl(raw: string, signal?: AbortSignal, publicOnly = false): Promise<URL> {
  return assertNormalizedPublicUrl(normalizeAuditUrl(raw), signal, publicOnly)
}
export function assertPublicNavigationUrl(raw: string, signal?: AbortSignal, publicOnly = false): Promise<URL> {
  return assertNormalizedPublicUrl(normalizeAuditNavigationUrl(raw), signal, publicOnly)
}

export async function safeFetchHtml(
  rawUrl: string,
  options: {
    timeoutMs?: number
    maxBytes?: number
    maxRedirects?: number
    headers?: Record<string, string>
  } = {}
): Promise<{
  html: string
  finalUrl: string
  statusCode: number
  headers: Record<string, string>
}> {
  const document = await fetchPublicBody(rawUrl, {
    ...options, timeoutMs: options.timeoutMs ?? 10_000, maxBytes: options.maxBytes ?? 5_000_000,
    accept: 'text/html,application/xhtml+xml',
  }, decodeDocument, true)
  return { html: document.body, finalUrl: document.finalUrl, statusCode: document.statusCode, headers: document.headers }
}

/** One bounded transport owns HTTP admission, redirects and response reads.
 * Capacity waiting and response collection have separate bounded budgets;
 * an explicit execution deadline remains the limit across both phases. */
async function fetchPublicBody<Body>(rawUrl: string, options: {
  timeoutMs?: number; maxBytes?: number; maxRedirects?: number; deadline?: number;
  accept?: string; decodeGzip?: boolean;
  publicOnly?: boolean; headers?: Record<string, string>; onRequestStart?: () => void;
}, decodeBody: (bytes: Buffer, contentType?: string) => Body, requireHtml = false): Promise<Omit<PublicHttpDocument, 'body'> & { body: Body }> {
  const timeoutMs = options.timeoutMs ?? 5000, deadline = options.deadline ?? Infinity
  const executionSignal = currentExecutionOwnership()?.signal
  const admissionExpiresAt = Math.min(deadline, Date.now() + timeoutMs)
  const admissionSignal = AbortSignal.timeout(Math.max(1, admissionExpiresAt - Date.now()))
  const release = await publicHttpCapacity.acquire(executionSignal ? AbortSignal.any([admissionSignal, executionSignal]) : admissionSignal)
  const responseExpiresAt = Date.now() + timeoutMs
  const expiresAt = Math.min(deadline, responseExpiresAt)
  const controller = new AbortController()
  const signal = executionSignal ? AbortSignal.any([controller.signal, executionSignal]) : controller.signal
  let transport: ReturnType<typeof httpDispatchers.lease> | undefined
  let expiredDuringDns = false
  const timer = setTimeout(() => {
    expiredDuringDns = transport?.resolvingDns ?? false
    controller.abort()
  }, Math.max(1, expiresAt - Date.now()))
  const redirects: string[] = []
  let uncertainRedirect = false
  const maxBytes = options.maxBytes ?? 1_000_000
  let requestInFlight = false
  try {
    signal.throwIfAborted()
    if (Date.now() >= expiresAt) throw new Error('Public evidence deadline exhausted')
    options.onRequestStart?.()
    let current = (await assertPublicAuditUrl(rawUrl, signal, options.publicOnly)).toString()
    const credentialOrigin = new URL(current).origin
    for (let hop = 0; hop <= (options.maxRedirects ?? 5); hop++) {
      signal.throwIfAborted()
      if (Date.now() >= expiresAt) throw new Error('Public evidence deadline exhausted')
      requestInFlight = true
      transport ??= httpDispatchers.lease(signal)
      let response: Response
      try {
        response = await fetch(current, { redirect: 'manual', signal, dispatcher: transport.dispatcher,
          headers: { 'User-Agent': 'FixFlags/1.0 (+https://fixflags.com)', Accept: options.accept ?? 'text/html,text/plain,application/xml,text/xml',
            ...(new URL(current).origin === credentialOrigin ? options.headers ?? {} : {}) } } as RequestInit & { dispatcher: Agent })
      } catch (error) {
        const failure = readCertificateFailure(error)
        if (failure && new URL(current).protocol === 'https:') throw new PublicCertificateError(current, [...redirects], failure, error)
        throw error
      }
      requestInFlight = false
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        requestInFlight = false
        if (!location) throw new Error('Redirect response is missing a location')
        uncertainRedirect ||= response.headers.has('set-cookie') || response.headers.has('cf-mitigated') || !isAutomaticRedirectStatus(response.status)
        const next = (await assertPublicAuditUrl(new URL(location, current).toString(), signal, options.publicOnly)).toString()
        if (hop === (options.maxRedirects ?? 5)) throw new PublicRedirectError({ finalUrl: current,
          statusCode: response.status, headers: Object.fromEntries(response.headers), redirects: [...redirects] }, uncertainRedirect,
        requireHtml ? `Destination exceeded ${options.maxRedirects ?? 5} redirects` : undefined)
        redirects.push(current)
        current = next
        continue
      }
      if (requireHtml && (!response.ok || !/text\/html|application\/xhtml\+xml/.test(response.headers.get('content-type')?.toLowerCase() ?? ''))) {
        await response.body?.cancel()
        throw new Error(!response.ok ? `Destination returned HTTP ${response.status}` : 'Destination did not return an HTML document')
      }
      if (requireHtml && !response.body) throw new Error('Destination returned an empty response')
      const headers = Object.fromEntries(response.headers.entries())
      if (!response.body) return { body: decodeBody(Buffer.alloc(0), headers['content-type']), finalUrl: current, statusCode: response.status, headers, complete: true, redirects }
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let bytes = 0, complete = true
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          if (bytes + value.byteLength > maxBytes) {
            chunks.push(value.subarray(0, maxBytes - bytes))
            complete = false
            await reader.cancel()
            break
          }
          bytes += value.byteLength
          chunks.push(value)
        }
        const collected = Buffer.concat(chunks)
        let documentBytes = collected
        // Fetch already decodes HTTP Content-Encoding. A gzip sitemap file may
        // still contain compressed bytes, independently of its response headers.
        if (options.decodeGzip && collected[0] === 0x1f && collected[1] === 0x8b) {
          const decoded = complete ? await readGzipDocument(collected, maxBytes, signal) : { bytes: Buffer.alloc(0), complete: false }
          documentBytes = decoded.bytes; complete = decoded.complete
        }
        const body = decodeBody(documentBytes, headers['content-type'])
        return { body, finalUrl: current, statusCode: response.status, headers, complete, redirects }
      } catch (error) {
        if (requireHtml) throw error
        const prefix = Buffer.concat(chunks)
        let body: string | null = null
        // Compressed file bytes are not inspected document text. Decoding a
        // collected text prefix is useful evidence, never proof of completeness.
        if (!(prefix[0] === 0x1f && prefix[1] === 0x8b)) {
          try { body = decodeDocument(prefix, headers['content-type']) } catch { /* Response facts remain available. */ }
        }
        throw new PublicResponseBodyError({ body, finalUrl: current, statusCode: response.status, headers, redirects: [...redirects] }, error)
      } finally {
        reader.releaseLock()
      }
    }
    throw new Error(requireHtml ? `Destination exceeded ${options.maxRedirects ?? 5} redirects` : 'Public evidence redirect limit exceeded')
  } catch (error) {
    if (requestInFlight && expiredDuringDns) throw new AuditUrlError(DNS_UNAVAILABLE_MESSAGE, 'DNS_UNAVAILABLE')
    if (requestInFlight && transport?.dnsFailure) throw transport.dnsFailure
    if (controller.signal.aborted && !executionSignal?.aborted && requestInFlight && responseExpiresAt <= deadline) {
      throw new PublicRequestError('Public response timed out')
    }
    throw error
  } finally {
    clearTimeout(timer)
    try { await transport?.release() } finally { release() }
  }
}

/** Raw HTTP evidence shares the bounded transport and origin-scoped headers. */
export function safeFetchDocument(rawUrl: string, options: {
  timeoutMs?: number; maxBytes?: number; maxRedirects?: number; deadline?: number;
  accept?: string; publicOnly?: boolean; headers?: Record<string, string>;
  /** Decode gzip file content within the same byte and execution bounds. */
  decodeGzip?: boolean;
  /** Called after local capacity admission, before URL and DNS validation. */
  onRequestStart?: () => void;
} = {}) {
  return fetchPublicBody(rawUrl, options, decodeDocument)
}

/** Binary evidence keeps the original bytes through the same public boundary. */
export function safeFetchResource(rawUrl: string, options: Parameters<typeof safeFetchDocument>[1] = {}) {
  return fetchPublicBody(rawUrl, options, bytes => bytes)
}
