import type { SiteConnectionProvider, SiteConnectionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { googleConnectionConfigured } from '@/lib/sites/connections/google'
import { cardContext, contextLinesForPage, type ConnectionFact, type PublicConnection } from '@/lib/sites/connections/match'
import { readAnalyticsPageFactScope, readAnalyticsReportScope, readSearchFactScope } from './report-scope'

export type { PublicConnection }

function present(status: SiteConnectionStatus): PublicConnection['status'] {
  if (status === 'UNAVAILABLE') return 'unavailable'
  if (status === 'CONNECTED') return 'connected'
  if (status === 'MISMATCH') return 'mismatch'
  if (status === 'REVOKED') return 'revoked'
  return 'needs_reauth'
}

export async function loadSiteConnectionViews(projectId: string): Promise<{
  searchConsole: PublicConnection
  analytics: PublicConnection
  facts: ConnectionFact[]
}> {
  const rows = await prisma.siteConnection.findMany({
    where: { projectId },
    include: { facts: true, project: { select: { canonicalHost: true } } },
  })
  const configured = googleConnectionConfigured()
  const byProvider = new Map(rows.map((row) => [row.provider, row]))
  const view = (provider: SiteConnectionProvider): PublicConnection => {
    const row = byProvider.get(provider)
    if (!row || row.status === 'REVOKED') {
      return {
        provider,
        configured,
        status: row?.status === 'REVOKED' ? 'revoked' : 'not_connected',
        propertyLabel: row?.propertyLabel ?? null,
        detail: row?.statusDetail ?? null,
        lastSyncedAt: row?.lastSyncedAt?.toISOString() ?? null,
      }
    }
    return {
      provider,
      configured,
      status: configured ? present(row.status) : 'unavailable',
      propertyLabel: row.propertyLabel,
      detail: row.statusDetail,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    }
  }
  return {
    searchConsole: view('SEARCH_CONSOLE'),
    analytics: view('ANALYTICS'),
    facts: rows.flatMap((row) => ['CONNECTED', 'UNAVAILABLE', 'NEEDS_REAUTH', 'REVOKED'].includes(row.status)
      ? row.facts.flatMap((fact) => {
        const reportScope = row.provider === 'ANALYTICS' && fact.kind === 'analytics_page'
          ? readAnalyticsPageFactScope(fact.reportScope, row.propertyId, row.project.canonicalHost)
          : row.provider === 'ANALYTICS' && fact.kind === 'analytics_site'
            ? readAnalyticsReportScope(fact.reportScope, row.propertyId, row.project.canonicalHost)
          : row.provider === 'SEARCH_CONSOLE' && fact.kind === 'search_query'
            ? readSearchFactScope(fact.reportScope, row.propertyId, row.project.canonicalHost) : null
        if (!reportScope || fact.kind === 'analytics_page' && (!('pagePath' in reportScope) || reportScope.pagePath !== fact.pagePath)) return []
        return [{
          kind: fact.kind === 'analytics_page' ? 'analytics_page' as const : fact.kind === 'analytics_site' ? 'analytics_site' as const : 'search_query' as const,
          pagePath: fact.pagePath,
          subject: fact.subject,
          clicks: fact.clicks,
          impressions: fact.impressions,
          sessions: fact.sessions,
          activeUsers: fact.activeUsers,
          pageViews: fact.pageViews,
          position: fact.position,
          reportScope,
          observedAt: fact.observedAt.toISOString(),
          lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
          periodStart: fact.periodStart?.toISOString() ?? null,
          periodEnd: fact.periodEnd?.toISOString() ?? null,
          contextState: row.status !== 'CONNECTED' || !configured ? 'unavailable' as const
            : Date.now() - fact.observedAt.getTime() >= 24 * 60 * 60 * 1000 ? 'stale' as const : 'current' as const,
        }]
      })
      : []),
  }
}

export function connectionLines(projectFacts: ConnectionFact[], pageUrl: string | null): string[] {
  return contextLinesForPage(projectFacts, pageUrl)
}

export function connectionCardNotes(projectFacts: ConnectionFact[]) {
  return cardContext(projectFacts)
}

