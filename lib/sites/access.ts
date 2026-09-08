import { prisma } from '@/lib/db'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import type { SiteRecord } from '@/lib/sites/types'

export type SiteViewer = {
  userId?: string | null
  /** Same key used at ensure (anonymous client id). */
  sessionKey?: string | null
  /** Claimed anonymous audit ids from the signed cookie. */
  anonAuditIds?: string[]
}

export type SiteAccessDecision =
  | { ok: true; site: SiteRecord; role: 'owner' | 'provisional_session' }
  | { ok: false; reason: 'not_found' | 'denied' }

/**
 * Private customer Site access. Knowledge of an id is not enough.
 * Owned Sites: owner only. Provisional Sites: matching session key or cookie-claimed primary audit.
 */
export async function resolveSiteAccess(
  siteId: string,
  viewer: SiteViewer
): Promise<SiteAccessDecision> {
  const site = await loadSiteRecord(siteId)
  if (!site) return { ok: false, reason: 'not_found' }

  if (site.kind === 'project') {
    if (viewer.userId && site.userId && viewer.userId === site.userId) {
      return { ok: true, site, role: 'owner' }
    }
    return { ok: false, reason: 'denied' }
  }

  const provisional = site.provisionalSiteId
    ? await prisma.provisionalSite.findUnique({
        where: { id: site.provisionalSiteId },
        select: { sessionKey: true, primaryAuditId: true, claimedProjectId: true },
      })
    : null

  if (!provisional) return { ok: false, reason: 'not_found' }

  if (provisional.claimedProjectId) {
    // loadSiteRecord should already have redirected; treat as denied if still provisional view
    return { ok: false, reason: 'denied' }
  }

  const sessionKey = viewer.sessionKey?.trim() || ''
  if (sessionKey && provisional.sessionKey === sessionKey) {
    return { ok: true, site, role: 'provisional_session' }
  }

  const anonIds = viewer.anonAuditIds ?? []
  if (provisional.primaryAuditId && anonIds.includes(provisional.primaryAuditId)) {
    return { ok: true, site, role: 'provisional_session' }
  }

  return { ok: false, reason: 'denied' }
}

/** Convenience for routes: map deny to HTTP-ish codes without leaking existence. */
export function siteAccessHttpStatus(decision: SiteAccessDecision): 404 {
  if (decision.ok) throw new Error('siteAccessHttpStatus called on allow')
  // Use 404 for both not_found and denied so ids are not enumerable.
  return 404
}
