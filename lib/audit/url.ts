import { resolve4, resolve6 } from 'node:dns/promises'
import { isIP } from 'node:net'

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
  return address.toLowerCase().split('%')[0]
}

function isPrivateIpv6(address: string): boolean {
  const value = normalizeIpv6(address)
  if (value === '::' || value === '::1') return true
  if (value.startsWith('fc') || value.startsWith('fd') || /^fe[89ab]/.test(value)) return true
  if (value.startsWith('ff') || value.startsWith('2001:db8')) return true
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/)
  return mapped ? isPrivateIpv4(mapped[1]) : false
}

export function isPublicIp(address: string): boolean {
  const version = isIP(address)
  if (version === 4) return !isPrivateIpv4(address)
  if (version === 6) return !isPrivateIpv6(address)
  return false
}

export function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, '')
  return (
    normalized === 'localhost' ||
    normalized.endsWith('.localhost') ||
    normalized.endsWith('.local') ||
    normalized.endsWith('.internal') ||
    normalized === 'metadata.google.internal' ||
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
  constructor(message: string) {
    super(message)
    this.name = 'AuditUrlError'
  }
}

export async function resolvePublicAddresses(hostname: string): Promise<string[]> {
  if (isBlockedHostname(hostname)) {
    throw new AuditUrlError('Destination is not publicly accessible')
  }
  if (isIP(hostname)) return [hostname]

  const [v4, v6] = await Promise.all([
    resolve4(hostname).catch(() => []),
    resolve6(hostname).catch(() => []),
  ])
  const addresses = [...v4, ...v6]
  if (addresses.length === 0) {
    throw new AuditUrlError('We could not find that domain. Check the URL and try again.')
  }
  if (addresses.some((address) => !isPublicIp(address))) {
    throw new AuditUrlError('Destination resolves to a private or reserved network')
  }
  return addresses
}

export async function assertPublicAuditUrl(raw: string): Promise<URL> {
  const normalized = normalizeAuditUrl(raw)
  if (!normalized.ok) throw new AuditUrlError(normalized.error)
  const parsed = new URL(normalized.url)
  await resolvePublicAddresses(parsed.hostname)
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
): Promise<{ html: string; finalUrl: string; headers: Record<string, string> }> {
  const timeoutMs = options.timeoutMs ?? 10_000
  const maxBytes = options.maxBytes ?? 5_000_000
  const maxRedirects = options.maxRedirects ?? 5
  let current = (await assertPublicAuditUrl(rawUrl)).toString()

  for (let redirect = 0; redirect <= maxRedirects; redirect++) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const response = await fetch(current, {
        signal: controller.signal,
        redirect: 'manual',
        headers: {
          'User-Agent': 'FixFlags/1.0 (+https://fixflags.com)',
          Accept: 'text/html,application/xhtml+xml',
          ...(options.headers ?? {}),
        },
      })

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location')
        if (!location) throw new Error('Redirect response is missing a location')
        current = (await assertPublicAuditUrl(new URL(location, current).toString())).toString()
        continue
      }
      if (!response.ok) {
        throw new Error(`Destination returned HTTP ${response.status}`)
      }
      const contentType = response.headers.get('content-type')?.toLowerCase() ?? ''
      if (!contentType.includes('text/html') && !contentType.includes('application/xhtml+xml')) {
        throw new Error('Destination did not return an HTML document')
      }

      if (!response.body) throw new Error('Destination returned an empty response')

      const responseHeaders: Record<string, string> = {}
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value
      })

      // Read up to maxBytes, then stop and scan what we have. A large page (heavy
      // inlined markup, big Next.js flight payloads) must not fail the whole audit
      // - the <head> and the top of the body carry almost all of what the checks
      // need, so a truncated document still yields an accurate scan.
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let total = 0
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (total + value.byteLength > maxBytes) {
          chunks.push(value.subarray(0, maxBytes - total))
          await reader.cancel()
          break
        }
        total += value.byteLength
        chunks.push(value)
      }

      return {
        html: new TextDecoder().decode(
          Buffer.concat(chunks.map((chunk) => Buffer.from(chunk)))
        ),
        finalUrl: current,
        headers: responseHeaders,
      }
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new Error(`Destination exceeded ${maxRedirects} redirects`)
}
