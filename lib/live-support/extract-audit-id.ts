const REPORT_PATH = /^\/(?:report|audit)\/([a-z0-9]+)/i

export function extractAuditIdFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const match = pathname.match(REPORT_PATH)
  return match?.[1] ?? null
}

export function extractAuditIdFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null
  try {
    return extractAuditIdFromPath(new URL(pageUrl).pathname)
  } catch {
    return null
  }
}
