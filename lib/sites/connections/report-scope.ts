import { z } from 'zod'

const scopeFields = { version: z.literal(1), propertyId: z.string().min(1).max(2000),
  hostnames: z.array(z.string().min(1).max(253)).min(1).max(2) }
export const analyticsReportScopeSchema = z.object({ ...scopeFields, kind: z.literal('analytics-hostnames') }).strict()
export const searchReportScopeSchema = z.object({ ...scopeFields, kind: z.literal('search-hostnames') }).strict()
const searchFactScopeSchema = searchReportScopeSchema.extend({ pageUrl: z.string().url().max(8192) })
export type AnalyticsReportScope = z.infer<typeof analyticsReportScopeSchema>
export type SearchReportScope = z.infer<typeof searchReportScopeSchema>
export type SearchFactScope = z.infer<typeof searchFactScopeSchema>
export type ConnectionReportScope = AnalyticsReportScope | SearchFactScope
export type AnalyticsAudience = { sessions?: number; activeUsers?: number; pageViews?: number }
export type AnalyticsPage = { pagePath?: string; sessions?: number; pageViews?: number }
export type AnalyticsReport = { pages: AnalyticsPage[]; audience: AnalyticsAudience }
export const ANALYTICS_PAGE_LIMIT = 25

/** Explicitly request the Site entry and bounded saved pages even outside the provider's top rows. */
export function analyticsWatchedPagePaths(siteUrl: string, pages: string[], scope: AnalyticsReportScope): string[] {
  const paths = new Set<string>()
  for (const value of [siteUrl, ...pages]) {
    try {
      const url = new URL(value)
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || !scope.hostnames.includes(url.hostname.toLowerCase())) continue
      paths.add(url.pathname)
      if (paths.size === ANALYTICS_PAGE_LIMIT) break
    } catch { /* Malformed saved pages do not expand the provider scope. */ }
  }
  return [...paths]
}

/** Match the existing Site identity's bare/www aliases, never sibling subdomains. */
function siteHostnames(host: string): string[] {
  const parsed = new URL('https://' + host.trim().toLowerCase())
  if (parsed.username || parsed.password || parsed.port || parsed.pathname !== '/' || parsed.search || parsed.hash) throw new Error('Invalid Site report host')
  const hostname = parsed.hostname.replace(/^www\./, '')
  return hostname.includes('.') && !/^\d+\.\d+\.\d+\.\d+$/.test(hostname) ? [hostname, 'www.' + hostname] : [hostname]
}

export function analyticsReportScope(host: string, propertyId: string): AnalyticsReportScope {
  return analyticsReportScopeSchema.parse({ version: 1, kind: 'analytics-hostnames', propertyId, hostnames: siteHostnames(host) })
}

export function searchReportScope(host: string, propertyId: string): SearchReportScope {
  return searchReportScopeSchema.parse({ version: 1, kind: 'search-hostnames', propertyId, hostnames: siteHostnames(host) })
}

/** Search Console URL-prefix properties are protocol-, host-, port-, and path-specific. */
export function searchPropertyCoversUrl(property: string, pageUrl: string): boolean {
  try {
    const page = new URL(pageUrl)
    if (!['http:', 'https:'].includes(page.protocol) || page.username || page.password) return false
    if (property.startsWith('sc-domain:')) {
      const domain = property.slice('sc-domain:'.length).toLowerCase().replace(/\.$/, '')
      return Boolean(domain) && (page.hostname.toLowerCase() === domain || page.hostname.toLowerCase().endsWith(`.${domain}`))
    }
    const prefix = new URL(property)
    return !prefix.username && !prefix.password && !prefix.search && !prefix.hash &&
      prefix.origin === page.origin && page.pathname.startsWith(prefix.pathname)
  } catch { return false }
}

export function searchPageFilter(scope: SearchReportScope): string {
  const escaped = scope.hostnames.map(host => host.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return `^https?://(${escaped.join('|')})(:[0-9]+)?/`
}

export function searchFactScope(scope: SearchReportScope, pageUrl: string): SearchFactScope | null {
  try {
    const page = new URL(pageUrl)
    if (!scope.hostnames.includes(page.hostname.toLowerCase()) || !searchPropertyCoversUrl(scope.propertyId, pageUrl)) return null
    return searchFactScopeSchema.parse({ ...scope, pageUrl })
  } catch { return null }
}

export function readSearchFactScope(value: unknown, propertyId: string | null, host: string): SearchFactScope | null {
  const parsed = searchFactScopeSchema.safeParse(value)
  if (!parsed.success || !propertyId || parsed.data.propertyId !== propertyId) return null
  try {
    const expected = searchReportScope(host, propertyId)
    return parsed.data.hostnames.length === expected.hostnames.length && expected.hostnames.every(hostname => parsed.data.hostnames.includes(hostname))
      ? searchFactScope(expected, parsed.data.pageUrl) : null
  } catch { return null }
}

export function readAnalyticsReportScope(value: unknown, propertyId: string | null, host: string): AnalyticsReportScope | null {
  const parsed = analyticsReportScopeSchema.safeParse(value)
  if (!parsed.success || !propertyId || parsed.data.propertyId !== propertyId) return null
  try {
    const expected = analyticsReportScope(host, propertyId)
    return parsed.data.hostnames.length === expected.hostnames.length && expected.hostnames.every(hostname => parsed.data.hostnames.includes(hostname)) ? parsed.data : null
  } catch { return null }
}
