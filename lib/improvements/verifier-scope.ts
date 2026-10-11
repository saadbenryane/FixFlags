/** Pure URL identity shared by evidence collection and durable verification. */
export function normalizeVerifierUrl(value: string): string {
  try {
    const url = new URL(value)
    url.hash = ''
    return url.toString().replace(/\/$/, '')
  } catch { return value.replace(/\/$/, '') }
}
export function verifierScopeKey(pageUrl: string | null): string {
  return pageUrl ? `page:${normalizeVerifierUrl(pageUrl)}` : 'product'
}
