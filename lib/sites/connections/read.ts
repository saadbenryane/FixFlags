import type { SiteConnectionProvider, SiteConnectionStatus } from '@prisma/client'
import { prisma } from '@/lib/db'
import { googleConnectionConfigured } from '@/lib/sites/connections/google'
import { cardContext, contextLinesForPage, type ConnectionFact, type PublicConnection } from '@/lib/sites/connections/match'

export type { PublicConnection }

function present(status: SiteConnectionStatus): PublicConnection['status'] {
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
    include: { facts: true },
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
      status: present(row.status),
      propertyLabel: row.propertyLabel,
      detail: row.statusDetail,
      lastSyncedAt: row.lastSyncedAt?.toISOString() ?? null,
    }
  }
  return {
    searchConsole: view('SEARCH_CONSOLE'),
    analytics: view('ANALYTICS'),
    facts: rows.flatMap((row) => row.status === 'CONNECTED'
      ? row.facts.map((fact) => ({
          kind: fact.kind === 'analytics_page' ? 'analytics_page' as const : 'search_query' as const,
          pagePath: fact.pagePath,
          subject: fact.subject,
          clicks: fact.clicks,
          impressions: fact.impressions,
          sessions: fact.sessions,
          position: fact.position,
        }))
      : []),
  }
}

export function connectionLines(projectFacts: ConnectionFact[], pageUrl: string | null): string[] {
  return contextLinesForPage(projectFacts, pageUrl)
}

export function connectionCardNotes(projectFacts: ConnectionFact[]) {
  return cardContext(projectFacts)
}

