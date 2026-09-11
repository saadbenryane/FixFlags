const REPORT_PATH = /^\/(?:report|audit)\/([a-z0-9]+)/i
const SITE_PATH = /^\/sites\/([a-z0-9_]+)/i
const SITE_FLAG_PATH = /^\/sites\/([a-z0-9_]+)\/flags\/([a-z0-9_-]+)/i

export function extractAuditIdFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const match = pathname.match(REPORT_PATH)
  return match?.[1] ?? null
}

export function extractSiteIdFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const match = pathname.match(SITE_PATH)
  return match?.[1] ?? null
}

export function extractFlagIdFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const match = pathname.match(SITE_FLAG_PATH)
  return match?.[2] ?? null
}

export function extractAuditIdFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null
  try {
    return extractAuditIdFromPath(new URL(pageUrl).pathname)
  } catch {
    return null
  }
}

export function extractSiteIdFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null
  try {
    return extractSiteIdFromPath(new URL(pageUrl).pathname)
  } catch {
    return null
  }
}

export function extractFlagIdFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null
  try {
    return extractFlagIdFromPath(new URL(pageUrl).pathname)
  } catch {
    return null
  }
}
