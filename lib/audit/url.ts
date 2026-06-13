/** Shared URL validation for audit creation. */

export function isBlockedHostname(hostname: string): boolean {
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname.startsWith('192.168.') ||
    hostname.startsWith('10.') ||
    hostname.endsWith('.local')
  ) {
    return true
  }
  if (hostname.startsWith('172.')) {
    const second = parseInt(hostname.split('.')[1] ?? '', 10)
    if (second >= 16 && second <= 31) return true
  }
  return false
}

export function normalizeAuditUrl(
  raw: string
): { ok: true; url: string } | { ok: false; error: string } {
  try {
    const parsed = new URL(raw)
    if (isBlockedHostname(parsed.hostname)) {
      return { ok: false, error: 'QualityOS can only audit publicly accessible URLs' }
    }
    return { ok: true, url: parsed.toString() }
  } catch {
    return { ok: false, error: 'Invalid URL format' }
  }
}
