/**
 * Shared URL helpers. Consolidates duplicated hostname extraction and path
 * labeling scattered across ~10 files. Import from here instead of
 * writing `new URL(url).hostname.replace(...)` inline.
 */

/**
 * Extract hostname from a URL string, stripping `www.` prefix.
 * Returns empty string on parse failure (safe for comparisons).
 */
export function parseSiteHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Extract hostname from a URL string, stripping `www.` prefix.
 * Returns the raw input string on parse failure (safe for display).
 */
export function displayHostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/**
 * Reviewed address for pane headers: hostname plus path, so a review of
 * `fixflags.com/demo` never reads as a review of `fixflags.com`.
 * Returns the raw input string on parse failure (safe for display).
 */
export function displaySiteAddress(url: string): string {
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.replace(/\/+$/, '')
    return `${parsed.hostname.replace(/^www\./, '')}${path}`
  } catch {
    return url
  }
}

/**
 * Normalize a hostname for storage or comparison: lowercase + strip www.
 * Accepts an already-extracted hostname string.
 */
export function normalizeSiteHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

/**
 * Customer-facing evidence URL. Hides browser-internal error pages while
 * preserving normal http(s) destinations for Flow/Timeline UI.
 */
export function displayEvidenceUrl(
  url: string | null | undefined,
  fallback = 'Could not load destination'
): string | null {
  if (!url?.trim()) return null
  const trimmed = url.trim()
  if (/^chrome-error:/i.test(trimmed) || /^chrome:/i.test(trimmed) || /^about:blank$/i.test(trimmed)) {
    return fallback
  }
  return trimmed
}
