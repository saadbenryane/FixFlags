import type { Audit, Prisma } from '@prisma/client'
import { prisma } from '@/lib/db'
import { verifyShareGrant } from '@/lib/security/share-grant'
import type { AuditAccessContext } from '@/lib/audit/access-context'

export type {
  AuditAccessContext,
  ReportChatGateReason,
  ReportClaimReason,
} from '@/lib/audit/access-context'
export { resolveReportChatGate } from '@/lib/audit/access-context'

import { canManageAudit, type SessionUser } from './access-ownership'
export { canAccessAudit, canManageAudit, canRetryAnonymousAudit, type AuditOwnership } from './access-ownership'

export const auditAccessSourceSelect = { id: true, userId: true, projectId: true, isPublic: true, url: true, status: true,
  user: { select: { lifecycleStatus: true } },
  project: { select: { userId: true, deletedAt: true, user: { select: { lifecycleStatus: true } } } },
} satisfies Prisma.AuditSelect
export function loadAuditAccessSource(id: string, db: Pick<Prisma.TransactionClient, 'audit'> = prisma) {
  return db.audit.findUnique({ where: { id }, select: auditAccessSourceSelect })
}

/** One live access decision for report pages, APIs, screenshots, and prompts.
 * Unclaimed + signed creator claim → anonymous_teaser. Public reports remain
 * available to public viewers. Private evidence requires its creator, owner or
 * an explicit current share grant. Curated samples never enter this path.
 */
export async function resolveAuditAccess(
  audit: Pick<Audit, 'id'> & Partial<Pick<Audit, 'userId' | 'isPublic'>>,
  sessionUser: SessionUser,
  shareGrantValue?: string,
  anonAuditIds: string[] = []
): Promise<AuditAccessContext> {
  const source = await loadAuditAccessSource(audit.id)
  if (!source) return 'denied'
  if (canManageAudit(source, sessionUser)) return 'owner'
  if (source.projectId === null && source.userId === null && anonAuditIds.includes(source.id)) return 'anonymous_teaser'

  if (source.isPublic) {
    return 'public_viewer'
  }

  const claims = verifyShareGrant(shareGrantValue)
  if (!claims || claims.auditId !== audit.id) return 'denied'
  const link = await prisma.shareLink.findUnique({
    where: { id: claims.linkId },
    select: {
      auditId: true,
      version: true,
      revoked: true,
      expiresAt: true,
    },
  })
  if (
    !link ||
    link.auditId !== audit.id ||
    link.version !== claims.linkVersion ||
    link.revoked ||
    Boolean(link.expiresAt && link.expiresAt <= new Date())
  ) return 'denied'
  return 'share_grant'
}
