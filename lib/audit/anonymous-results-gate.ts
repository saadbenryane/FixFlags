import type { AuditAccessContext } from '@/lib/audit/access-context'
import { customerSiteIdForAudit, siteBoardPath } from '@/lib/sites/site-id-for-audit'

/**
 * Results belong to an account. A signed anonymous creator keeps the right to
 * follow and claim the check, but every response that carries findings,
 * captures or evidence treats that creator like a signed-out visitor.
 */
export function resultsRequireSignIn(access: AuditAccessContext | null | undefined): boolean {
  return access === 'anonymous_teaser'
}

/** The Site results gate for an anonymous check, or null when it has none. */
export async function anonymousResultsGatePath(audit: { id: string; projectId: string | null }): Promise<string | null> {
  const siteId = await customerSiteIdForAudit(audit)
  return siteId === audit.id ? null : siteBoardPath(siteId)
}
