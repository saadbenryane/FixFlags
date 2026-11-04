export type WebsiteAddressFailure = 'empty' | 'malformed' | 'scheme' | 'credentials'
type WebsiteAddress = { ok: true; url: string; parsed: URL } | { ok: false; reason: WebsiteAddressFailure }

/** Syntax only. Server admission still owns DNS and public-network access.
 * Keep the supplied path, query and fragment when adding an entry's default scheme. */
export function parseWebsiteAddress(raw: string, { inferHttps = false }: { inferHttps?: boolean } = {}): WebsiteAddress {
  if (typeof raw !== 'string') return { ok: false, reason: 'malformed' }
  let url = raw.trim()
  if (!url) return { ok: false, reason: 'empty' }
  if (inferHttps) {
    const scheme = /^[a-z][a-z0-9+.-]*:/i.test(url)
    const hostWithPort = /^(?:[^\s/?#:@]+\.[^\s/?#:@]+|localhost|\[[0-9a-f:.]+\]):\d+(?:[/?#]|$)/i.test(url)
    if (url.startsWith('//')) url = `https:${url}`
    else if (!scheme || hostWithPort) url = `https://${url}`
  }
  try {
    const parsed = new URL(url)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return { ok: false, reason: 'scheme' }
    if (parsed.username || parsed.password) return { ok: false, reason: 'credentials' }
    return { ok: true, url, parsed }
  } catch { return { ok: false, reason: 'malformed' } }
}
