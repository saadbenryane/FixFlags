export function reportIdFromNextPath(next: string | null): string | null {
  if (!next) return null
  const match = /^\/report\/([^/?#]+)$/.exec(next)
  return match?.[1] ?? null
}

export type SiteAuthDestination = { kind: 'site' | 'report'; id: string; href: string }

/** Identify the Site context without changing the customer's return destination. */
export function siteAuthDestination(next: string | null): SiteAuthDestination | null {
  if (!next || !next.startsWith('/') || next.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(next)) return null
  try {
    const parsed = new URL(next, 'https://auth-context.invalid')
    if (/[\\\u0000-\u0020\u007f]/.test(decodeURIComponent(parsed.pathname))) return null
    const site = /^\/sites\/([^/]+)(?:\/.*)?$/.exec(parsed.pathname)
    const report = reportIdFromNextPath(parsed.pathname)
    const rawId = site?.[1] ?? report
    if (!rawId) return null
    const id = decodeURIComponent(rawId)
    if (!id || id.length > 200 || id === '.' || id === '..' || /[\\/?#\u0000-\u0020\u007f]/.test(id)) return null
    return { kind: site ? 'site' : 'report', id, href: next }
  } catch { return null }
}
