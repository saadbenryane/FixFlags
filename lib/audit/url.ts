import { resolve4, resolve6 } from 'node:dns/promises'
import { isIP, type LookupFunction } from 'node:net'
import { Agent } from 'undici'
import { publicHttpCapacity } from './progressive/capacity'

const PUBLIC_PROTOCOLS = new Set(['http:', 'https:'])

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number)
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return true
  }
  const [a, b] = parts
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 0 || b === 168)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0) ||
    a >= 224
  )
}

function normalizeIpv6(address: string): string {
  const value = address.toLowerCase().split('%')[0]
  try { return new URL(`http://[${value}]`).hostname.replace(/^\[|\]$/g, '') }
  catch { return value }
}

function isPrivateIpv6(address: string): boolean {
  const value = normalizeIpv6(address)
  if (value === '::' || value === '::1') return true
  if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return true
  if (value.startsWith('ff') || value.startsWith('2001:db8')) return true
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  if (mapped) return isPrivateIpv4(mapped[1])
  const hexMapped = value.match(/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/)
  if (hexMapped) {
    const high = parseInt(hexMapped[1], 16), low = parseInt(hexMapped[2], 16)
    return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`)
  }
  return false
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return !isPrivateIpv4(address)
  if (version === 6) return !isPrivateIpv6(address)
  return false
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

export function normalizeAuditUrl(
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const parsed = new URL(raw.trim())
    if (!PUBLIC_PROTOCOLS.has(parsed.protocol)) {
      return { ok: false, error: 'Only public HTTP and HTTPS URLs can be checked' }
    }
    if (parsed.username || parsed.password) {
      return { ok: false, error: 'URLs containing credentials cannot be checked' }
    }
    if (isBlockedHostname(parsed.hostname)) {
      return { ok: false, error: 'FixFlags can only check publicly accessible URLs' }
    }
    parsed.hash = ''
    return { ok: true, url: parsed.toString() }
  } catch {
    return { ok: false, error: 'Invalid URL format' }
  }
}

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

export async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  hostname = hostname.replace(/^\[|\]$/g, '')
  if (isBlockedHostname(hostname)) {
    throw new AuditUrlError('Destination is not publicly accessible')
  }
  if (isIP(hostname)) return [hostname]

  const results = await Promise.allSettled([resolve4(hostname), resolve6(hostname)])
  const [v4, v6] = results.map(result => result.status === 'fulfilled' ? result.value : [])
  const addresses = [...v4, ...v6]
  if (addresses.length === 0) {
    const absent = results.every(result => result.status === 'fulfilled' || ['ENOTFOUND', 'ENODATA'].includes(result.reason?.code))
    throw new AuditUrlError('We could not find that domain. Check the URL and try again.', absent ? 'DNS_NOT_FOUND' : 'DNS_UNAVAILABLE')
  }
  if (addresses.some((address) => !isPublicIp(address))) {
    throw new AuditUrlError('Destination resolves to a private or reserved network')
  }
  return addresses
}

// Validate the addresses delivered to the socket, not only an earlier DNS
// answer. Keep the URL hostname for Host, TLS identity and connection reuse.
export const publicSocketLookup: LookupFunction = (hostname, options, callback) => {
  void resolvePublicAddresses(hostname).then(addresses => {
    const family = options.family === 'IPv4' ? 4 : options.family === 'IPv6' ? 6 : options.family
    const eligible = family ? addresses.filter(address => isIP(address) === family) : addresses
    if (!eligible.length) throw new AuditUrlError('No public address matches the requested family', 'DNS_NOT_FOUND')
    if (options.all) callback(null, eligible.map(address => ({ address, family: isIP(address) })))
    else callback(null, eligible[0], isIP(eligible[0]))
  }).catch(error => callback(error instanceof Error ? error : new Error('Public address validation failed'), ''))
}
const publicDispatcher = new Agent({ connect: { lookup: publicSocketLookup } })

export async function assertPublicAuditUrl(raw: string, signal?: AbortSignal, publicOnly = false): Promise<URL> {
  const normalized = normalizeAuditUrl(raw)
  if (!normalized.ok) throw new AuditUrlError(normalized.error)
  const parsed = new URL(normalized.url)
  if (publicOnly && isBlockedHostname(parsed.hostname, false)) throw new AuditUrlError('Destination is not publicly accessible')
  signal?.throwIfAborted()
  const lookup = resolvePublicAddresses(parsed.hostname)
  if (!signal) await lookup
  else {
    let abort: (() => void) | undefined
    try {
      await Promise.race([lookup, new Promise<never>((_resolve, reject) => {
        abort = () => reject(signal.reason)
        signal.addEventListener('abort', abort, { once: true })
        if (signal.aborted) abort()
      })])
    } finally { if (abort) signal.removeEventListener('abort', abort) }
  }
  return parsed
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
  const document = await fetchPublicDocument(rawUrl, {
    ...options, timeoutMs: options.timeoutMs ?? 10_000, maxBytes: options.maxBytes ?? 5_000_000,
    accept: 'text/html,application/xhtml+xml',
  }, true)
  return { html: document.body, finalUrl: document.finalUrl, statusCode: document.statusCode, headers: document.headers }
}

/** One bounded transport owns HTTP admission, redirects and response reads.
 * Capacity waiting and response collection have separate bounded budgets;
 * an explicit execution deadline remains the limit across both phases. */
async function fetchPublicDocument(rawUrl: string, options: {
  timeoutMs?: number; maxBytes?: number; maxRedirects?: number; deadline?: number;
  accept?: string;
  publicOnly?: boolean; headers?: Record<string, string>; onRequestStart?: () => void;
} = {}, requireHtml = false): Promise<{
  body: string; finalUrl: string; statusCode: number; headers: Record<string, string>;
  complete: boolean; redirects: string[];
}> {
  const timeoutMs = options.timeoutMs ?? 5000, deadline = options.deadline ?? Infinity
  const admissionExpiresAt = Math.min(deadline, Date.now() + timeoutMs)
  const release = await publicHttpCapacity.acquire(AbortSignal.timeout(Math.max(1, admissionExpiresAt - Date.now())))
  const responseExpiresAt = Date.now() + timeoutMs
  const expiresAt = Math.min(deadline, responseExpiresAt)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), Math.max(1, expiresAt - Date.now()))
  const redirects: string[] = []
  const maxBytes = options.maxBytes ?? 1_000_000
  let requestInFlight = false
  try {
    if (Date.now() >= expiresAt) throw new Error('Public evidence deadline exhausted')
    options.onRequestStart?.()
    let current = (await assertPublicAuditUrl(rawUrl, controller.signal, options.publicOnly)).toString()
    const credentialOrigin = new URL(current).origin
    for (let hop = 0; hop <= (options.maxRedirects ?? 5); hop++) {
      if (Date.now() >= expiresAt) throw new Error('Public evidence deadline exhausted')
      requestInFlight = true
      const response = await fetch(current, { redirect: 'manual', signal: controller.signal, dispatcher: publicDispatcher,
        headers: { 'User-Agent': 'FixFlags/1.0 (+https://fixflags.com)', Accept: options.accept ?? 'text/html,text/plain,application/xml,text/xml',
          ...(new URL(current).origin === credentialOrigin ? options.headers ?? {} : {}) } } as RequestInit & { dispatcher: Agent })
      requestInFlight = false
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        await response.body?.cancel()
        requestInFlight = false
        if (!location) throw new Error('Redirect response is missing a location')
        redirects.push(current)
        current = (await assertPublicAuditUrl(new URL(location, current).toString(), controller.signal, options.publicOnly)).toString()
        continue
      }
      if (requireHtml && (!response.ok || !/text\/html|application\/xhtml\+xml/.test(response.headers.get('content-type')?.toLowerCase() ?? ''))) {
        await response.body?.cancel()
        throw new Error(!response.ok ? `Destination returned HTTP ${response.status}` : 'Destination did not return an HTML document')
      }
      if (requireHtml && !response.body) throw new Error('Destination returned an empty response')
      const headers = Object.fromEntries(response.headers.entries())
      if (!response.body) return { body: '', finalUrl: current, statusCode: response.status, headers, complete: true, redirects }
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
      } finally { reader.releaseLock() }
      return { body: new TextDecoder().decode(Buffer.concat(chunks)), finalUrl: current,
        statusCode: response.status, headers, complete, redirects }
    }
    throw new Error(requireHtml ? `Destination exceeded ${options.maxRedirects ?? 5} redirects` : 'Public evidence redirect limit exceeded')
  } catch (error) {
    if (controller.signal.aborted && requestInFlight && responseExpiresAt <= deadline)
      throw new PublicRequestError('Public response timed out')
    throw error
  } finally { clearTimeout(timer); release() }
}

/** Raw HTTP evidence shares the bounded transport and origin-scoped headers. */
export function safeFetchDocument(rawUrl: string, options: {
  timeoutMs?: number; maxBytes?: number; maxRedirects?: number; deadline?: number;
  accept?: string; publicOnly?: boolean; headers?: Record<string, string>;
  /** Called after local capacity admission, before URL and DNS validation. */
  onRequestStart?: () => void;
} = {}) {
  return fetchPublicDocument(rawUrl, options)
}
