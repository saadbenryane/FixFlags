import { Audit } from '@prisma/client'
import { prisma } from '@/lib/db'
import { canSharePublicly } from '@/lib/auth/entitlements'
import { verifyShareGrant } from '@/lib/security/share-grant'
import type { AuditAccessContext } from '@/lib/audit/access-context'

export type {
  AuditAccessContext,
  ReportChatGateReason,
  ReportClaimReason,
} from '@/lib/audit/access-context'
export { resolveReportChatGate } from '@/lib/audit/access-context'

type SessionUser = { id: string } | null | undefined

export function canAccessAudit(
  audit: Pick<Audit, 'userId' | 'isPublic'>,
  sessionUser: SessionUser
): boolean {
  if (audit.isPublic) return true
  if (audit.userId === null) return true
  if (sessionUser?.id && audit.userId === sessionUser.id) return true
  return false
}

export function canManageAudit(
  audit: Pick<Audit, 'userId'>,
  sessionUser: SessionUser
): boolean {
  if (!audit.userId) return false
  return sessionUser?.id === audit.userId
}

/**
 * Anonymous visitors may retry their OWN failed teaser scan, gated on the
 * anonymous-audit cookie (ANON_AUDIT_IDS_COOKIE) instead of userId.
 * Public-by-default teasers stay retryable when the cookie lists this id.
 */
export function canRetryAnonymousAudit(
  audit: Pick<Audit, 'userId' | 'isPublic'>,
  auditId: string,
  anonAuditIds: string[]
): boolean {
  if (audit.userId !== null) return false
  return anonAuditIds.includes(auditId)
}

/** One live access decision for report pages, APIs, screenshots, and prompts.
 * Unclaimed + cookie → anonymous_teaser. Unclaimed without cookie, or owned public
 * and not the owner → public_viewer. marketing_sample is never assigned here.
 */
export async function resolveAuditAccess(
  audit: Pick<Audit, 'id' | 'userId' | 'isPublic'>,
  sessionUser: SessionUser,
  shareGrantValue?: string,
  anonAuditIds: string[] = []
): Promise<AuditAccessContext> {
  if (sessionUser?.id && audit.userId === sessionUser.id) return 'owner'
  if (audit.userId === null) {
    if (anonAuditIds.includes(audit.id)) return 'anonymous_teaser'
    return 'public_viewer'
  }

  if (audit.isPublic) {
    const owner = await prisma.user.findUnique({
      where: { id: audit.userId },
      select: { id: true, role: true, plan: true, subscriptionStatus: true },
    })
    if (owner && canSharePublicly(owner)) return 'public_viewer'
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
      audit: {
        select: {
          user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
        },
      },
    },
  })
  if (
    !link ||
    link.auditId !== audit.id ||
    link.version !== claims.linkVersion ||
    link.revoked ||
    Boolean(link.expiresAt && link.expiresAt <= new Date()) ||
    !link.audit.user ||
    !canSharePublicly(link.audit.user)
  ) return 'denied'
  return 'share_grant'
}
