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
 * Normalize a hostname for storage or comparison: lowercase + strip www.
 * Accepts an already-extracted hostname string.
 */
export function normalizeSiteHost(hostname: string): string {
  return hostname.toLowerCase().replace(/^www\./, '')
}

/**
 * Extract the first meaningful path segment from a URL for display labels.
 * Returns empty string for root path or on parse failure.
 *
 * Example:
 *   `/pricing` → `pricing`
 *   `/blog/best-practices` → `blog`
 *   `/` → ``
 */
export function parsePageLabel(url: string): string {
  try {
    const pathname = new URL(url).pathname
    return pathname.split('/').filter(Boolean)[0] ?? ''
  } catch {
    return ''
  }
}
