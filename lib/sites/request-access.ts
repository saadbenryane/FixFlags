import { headers } from 'next/headers'
import { auth } from '@/lib/auth'
import { readClaimedAnonymousIds } from '@/lib/audit/usage'
import { requestClientId } from '@/lib/security/rate-limit'
import {
  resolveSiteAccess,
  siteAccessHttpStatus,
  type SiteAccessDecision,
} from '@/lib/sites/access'

/** Resolve the current Site viewer from session + anon client id + claim cookie. */
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
    sessionKey: requestClientId(headerStore),
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
