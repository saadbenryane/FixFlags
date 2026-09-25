export type ConnectionProviderName = 'SEARCH_CONSOLE' | 'ANALYTICS'

export type PublicConnection = {
  provider: ConnectionProviderName
  configured: boolean
  status: 'not_connected' | 'connected' | 'mismatch' | 'needs_reauth' | 'revoked'
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
  kind: 'search_query' | 'analytics_page'
  pagePath: string | null
  subject: string
  clicks: number | null
  impressions: number | null
  sessions: number | null
  position: number | null
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
}>): ConnectionFact[] {
  return rows.slice(0, 25).flatMap((row) => {
    const page = pagePathOf(row.keys?.[0])
    const query = row.keys?.[1]?.trim().slice(0, 120)
    if (!page || !query) return []
    return [{
      kind: 'search_query' as const,
      pagePath: page,
      subject: query,
      clicks: numberOrNull(row.clicks),
      impressions: numberOrNull(row.impressions),
      sessions: null,
      position: numberOrNull(row.position),
    }]
  })
}

export function factsFromAnalyticsRows(rows: Array<{ pagePath?: string; sessions?: number }>): ConnectionFact[] {
  return rows.slice(0, 25).flatMap((row) => {
    const page = pagePathOf(row.pagePath)
    if (!page) return []
    return [{
      kind: 'analytics_page' as const,
      pagePath: page,
      subject: 'sessions',
      clicks: null,
      impressions: null,
      sessions: numberOrNull(row.sessions),
      position: null,
    }]
  })
}

export function contextLinesForPage(facts: ConnectionFact[], pageUrl: string | null): string[] {
  const path = pagePathOf(pageUrl)
  if (!path) return []
  const onPage = facts.filter((fact) => fact.pagePath === path)
  const lines: string[] = []
  const queries = onPage
    .filter((fact) => fact.kind === 'search_query')
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))
    .slice(0, 2)
  for (const query of queries) {
    lines.push(
      `Search Console: "${query.subject}" had ${query.impressions ?? 0} impressions and ${query.clicks ?? 0} clicks on this page over the last 28 days.`,
    )
  }
  const sessions = onPage
    .filter((fact) => fact.kind === 'analytics_page')
    .reduce((sum, fact) => sum + (fact.sessions ?? 0), 0)
  if (onPage.some((fact) => fact.kind === 'analytics_page')) {
    lines.push(`Analytics: this page had ${sessions} sessions over the last 28 days.`)
  }
  return lines
}

export function cardContext(facts: ConnectionFact[]): { search: string | null; tracking: string | null } {
  const top = facts
    .filter((fact) => fact.kind === 'search_query')
    .sort((a, b) => (b.impressions ?? 0) - (a.impressions ?? 0))[0]
  const sessions = facts
    .filter((fact) => fact.kind === 'analytics_page')
    .reduce((sum, fact) => sum + (fact.sessions ?? 0), 0)
  return {
    search: top ? `Search Console: "${top.subject}" had ${top.impressions ?? 0} impressions in the last 28 days.` : null,
    tracking: facts.some((fact) => fact.kind === 'analytics_page')
      ? `Analytics counted ${sessions} sessions on watched pages in the last 28 days.`
      : null,
  }
}

function numberOrNull(value: number | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}
