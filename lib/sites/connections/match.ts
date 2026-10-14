import { searchFactScope, ANALYTICS_PAGE_LIMIT, type AnalyticsPage, type AnalyticsReportScope, type AnalyticsAudience, type SearchReportScope, type ConnectionReportScope } from './report-scope'
import { SITE_CONNECTION_COPY as C } from '@/lib/marketing/copy/site-connections'

export type ConnectionProviderName = 'SEARCH_CONSOLE' | 'ANALYTICS'

export type PublicConnection = {
  provider: ConnectionProviderName
  configured: boolean
  status: 'not_connected' | 'connected' | 'mismatch' | 'needs_reauth' | 'revoked' | 'unavailable'
  propertyLabel: string | null
  detail: string | null
  lastSyncedAt: string | null
}

export type SearchProperty = { siteUrl: string }

export type AnalyticsProperty = {
  propertyId: string
  label: string
  streamUrls: string[]
}

export type ConnectionFact = {
  kind: 'search_query' | 'analytics_page' | 'analytics_site'
  pagePath: string | null
  subject: string
  clicks: number | null
  impressions: number | null
  sessions: number | null
  activeUsers?: number | null
  pageViews?: number | null
  position: number | null
  observedAt?: string | null
  lastSyncedAt?: string | null
  periodStart?: string | null
  periodEnd?: string | null
  contextState?: 'current' | 'stale' | 'unavailable'
  reportScope?: ConnectionReportScope | null
}

export function canonicalHost(value: string): string {
  return value.trim().toLowerCase().replace(/^www\./, '')
}

export function pagePathOf(value: string | null | undefined): string | null {
  if (!value) return null
  try {
    const url = value.includes('://') ? new URL(value) : new URL(value, 'https://example.com')
    const path = url.pathname || '/'
    return path.length > 1 ? path.replace(/\/$/, '') : path
  } catch {
    return null
  }
}

export function searchPropertyMatches(siteUrl: string, host: string): boolean {
  const wanted = canonicalHost(host)
  const value = siteUrl.trim().toLowerCase()
  if (value === `sc-domain:${wanted}`) return true
  try {
    const url = new URL(value)
    return canonicalHost(url.hostname) === wanted
  } catch {
    return false
  }
}

export function chooseSearchProperty(properties: SearchProperty[], host: string): string | null {
  return properties.find((property) => searchPropertyMatches(property.siteUrl, host))?.siteUrl ?? null
}

export function chooseAnalyticsProperty(properties: AnalyticsProperty[], host: string): AnalyticsProperty | null {
  return properties.find((property) =>
    property.streamUrls.some((streamUrl) => {
      try {
        return canonicalHost(new URL(streamUrl).hostname) === canonicalHost(host)
      } catch {
        return false
      }
    }),
  ) ?? null
}

export function factsFromSearchRows(rows: Array<{
  keys?: string[]
  clicks?: number
  impressions?: number
  position?: number
}>, scope?: SearchReportScope): ConnectionFact[] {
  return rows.slice(0, 25).flatMap((row) => {
    const reportScope = scope && row.keys?.[0] ? searchFactScope(scope, row.keys[0]) : null
    if (!reportScope) return []
    const page = pagePathOf(row.keys?.[0])
    const query = row.keys?.[1]?.trim().slice(0, 120)
    if (!page || !query) return []
    return [{
      kind: 'search_query' as const,
      pagePath: page,
      subject: query,
      clicks: countOrNull(row.clicks),
      impressions: countOrNull(row.impressions),
      sessions: null,
      position: numberOrNull(row.position),
      reportScope,
    }]
  })
}

export function factsFromAnalyticsRows(rows: AnalyticsPage[], reportScope?: AnalyticsReportScope): ConnectionFact[] {
  return rows.slice(0, 2 * ANALYTICS_PAGE_LIMIT).flatMap((row) => {
    const page = pagePathOf(row.pagePath)
    if (!page) return []
    return [{
      kind: 'analytics_page' as const,
      pagePath: page,
      subject: 'sessions',
      clicks: null,
      impressions: null,
      sessions: countOrNull(row.sessions),
      pageViews: countOrNull(row.pageViews),
      position: null,
      ...(reportScope ? { reportScope } : {}),
    }]
  })
}

export function factsFromAnalyticsAudience(audience: AnalyticsAudience, reportScope: AnalyticsReportScope): ConnectionFact[] {
  const sessions = countOrNull(audience.sessions), activeUsers = countOrNull(audience.activeUsers), pageViews = countOrNull(audience.pageViews)
  return sessions === null && activeUsers === null && pageViews === null ? [] : [{ kind: 'analytics_site', pagePath: null, subject: 'audience',
    clicks: null, impressions: null, sessions, activeUsers, pageViews, position: null, reportScope }]
}

export function contextLinesForPage(facts: ConnectionFact[], pageUrl: string | null): string[] {
  const path = pagePathOf(pageUrl)
  if (!path) return []
  const onPage = facts.filter((fact) => fact.pagePath === path)
  let hostname: string | null = null
  try { hostname = pageUrl ? new URL(pageUrl).hostname.toLowerCase() : null } catch { /* Relative paths do not establish a hostname. */ }
  const lines: string[] = []
  const queries = onPage
    .filter((fact) => fact.kind === 'search_query' && fact.reportScope?.kind === 'search-hostnames' &&
      hostname && fact.reportScope.hostnames.includes(hostname) && (fact.impressions !== null || fact.clicks !== null))
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .slice(0, 2)
  for (const query of queries) {
    lines.push(
      C.searchPage(query.subject, query.impressions, query.clicks, factPeriod(query), factAge(query)),
    )
  }
  const measured = onPage.filter(fact => fact.kind === 'analytics_page' && (fact.sessions !== null || fact.pageViews != null) && fact.reportScope?.kind === 'analytics-hostnames' &&
    hostname && fact.reportScope.hostnames.includes(hostname))
  if (measured.length) {
    const observation = measured[0]
    lines.push(C.analyticsPage(observation.sessions, observation.pageViews ?? null, factPeriod(observation), factAge(observation)))
  }
  return lines
}

export function cardContext(facts: ConnectionFact[]): { search: string | null; tracking: string | null } {
  const top = facts
    .filter((fact) => fact.kind === 'search_query' && fact.reportScope?.kind === 'search-hostnames' && (fact.impressions !== null || fact.clicks !== null))
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0]
  const measured = facts.filter(fact => fact.kind === 'analytics_page' && (fact.sessions !== null || fact.pageViews != null) && fact.reportScope?.kind === 'analytics-hostnames')
  const audience = facts.find(fact => fact.kind === 'analytics_site' && fact.reportScope?.kind === 'analytics-hostnames' && (fact.sessions !== null || fact.activeUsers != null || fact.pageViews != null))
  return {
    search: top ? C.searchPage(top.subject, top.impressions, top.clicks, factPeriod(top), factAge(top)) : null,
    tracking: audience ? C.analyticsAudience(audience.sessions, audience.activeUsers ?? null, audience.pageViews ?? null, factPeriod(audience), factAge(audience)) : measured.length
      ? C.analyticsPages(new Set(measured.map(fact => fact.pagePath)).size, factPeriod(measured[0]), factAge(measured[0]))
      : null,
  }
}

function factPeriod(fact: ConnectionFact): string {
  return fact.periodStart && fact.periodEnd ? `from ${fact.periodStart.slice(0, 10)} to ${fact.periodEnd.slice(0, 10)}` : 'for an unknown reporting period'
}

function factAge(fact: ConnectionFact): string {
  const date = fact.observedAt ? `Read ${fact.observedAt.slice(0, 10)}.` : 'Observation date unknown.'
  return `${date}${fact.contextState === 'unavailable' ? ' Provider unavailable; retained context.' : fact.contextState === 'stale' ? ' Retained context is stale.' : ''}`
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function countOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : null
}
