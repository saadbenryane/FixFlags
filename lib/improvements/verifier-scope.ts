/** Pure URL identity shared by evidence collection and durable verification. */
export function normalizeVerifierUrl(value: string): string {
  try {
    const url = new URL(value)
    const serialized = url.toString()
    // Preserve the established root key without changing path or query identity.
    return url.pathname === '/' && !url.search && !url.hash && serialized.endsWith('/')
      ? serialized.slice(0, -1) : serialized
  } catch { return value }
}
export function verifierScopeKey(pageUrl: string | null): string {
  return pageUrl ? `page:${normalizeVerifierUrl(pageUrl)}` : 'product'
}
