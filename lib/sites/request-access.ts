import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { readClaimedAnonymousIds } from '@/lib/audit/usage'
import { peekVisitorKey } from '@/lib/sites/visitor-identity'
import {
  resolveSiteAccess,
  siteAccessHttpStatus,
  type SiteAccessDecision,
} from '@/lib/sites/access'

/** Resolve the current Site viewer from session + anon visitor key + claim cookie. */
export async function currentSiteViewer(): Promise<{
  userId: string | null
  sessionKey: string
  anonAuditIds: string[]
}> {
  const headerStore = await headers()
  const session = await auth.api.getSession({ headers: headerStore }).catch(() => null)
  const anonAuditIds = await readClaimedAnonymousIds()
  return {
    userId: session?.user?.id ?? null,
    // Read-only: resolving a board must never mint an identity, and it must
    // match the key that wrote the board, not the request IP.
    sessionKey: await peekVisitorKey(),
    anonAuditIds,
  }
}

export async function requireSiteAccess(siteId: string): Promise<
  | { ok: true; decision: Extract<SiteAccessDecision, { ok: true }> }
  | { ok: false; status: 404; message: string }
> {
  const viewer = await currentSiteViewer()
  const decision = await resolveSiteAccess(siteId, viewer)
  if (!decision.ok) {
    return {
      ok: false,
      status: siteAccessHttpStatus(decision),
      message: 'Site not found',
    }
  }
  return { ok: true, decision }
}

/** Resolve an authenticated owner and the private Project behind one Site. */
export async function requireSiteOwner(siteId: string): Promise<
  | { ok: true; decision: Extract<SiteAccessDecision, { ok: true }>; projectId: string }
  | { ok: false; status: 403 | 404; message: string }
> {
  const access = await requireSiteAccess(siteId)
  if (!access.ok) return access
  const projectId = access.decision.site.projectId
  if (access.decision.role !== 'owner' || !projectId) {
    return { ok: false, status: 403, message: 'Claim this Site first.' }
  }
  return { ok: true, decision: access.decision, projectId }
}
