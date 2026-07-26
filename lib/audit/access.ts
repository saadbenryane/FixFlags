import { Audit } from '@prisma/client'
import { prisma } from '@/lib/db'
import { canSharePublicly } from '@/lib/auth/entitlements'
import { verifyShareGrant } from '@/lib/security/share-grant'

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

export type AuditAccessContext =
  | 'owner'
  | 'anonymous_teaser'
  | 'marketing_sample'
  | 'studio_public'
  | 'share_grant'
  | 'denied'

/** One live access decision for report pages, APIs, screenshots, and prompts. */
export async function resolveAuditAccess(
  audit: Pick<Audit, 'id' | 'userId' | 'isPublic'>,
  sessionUser: SessionUser,
  shareGrantValue?: string
): Promise<AuditAccessContext> {
  if (sessionUser?.id && audit.userId === sessionUser.id) return 'owner'
  if (audit.userId === null) return audit.isPublic ? 'marketing_sample' : 'anonymous_teaser'

  if (audit.isPublic) {
    const owner = await prisma.user.findUnique({
      where: { id: audit.userId },
      select: { id: true, role: true, plan: true, subscriptionStatus: true },
    })
    if (owner && canSharePublicly(owner)) return 'studio_public'
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
