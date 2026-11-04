import type { Audit } from '@prisma/client'

export type SessionUser = { id: string } | null | undefined

export type AuditOwnership = Pick<Audit, 'userId' | 'projectId'> & {
  user?: { lifecycleStatus: string } | null
  project?: { userId: string; deletedAt: Date | null; user: { lifecycleStatus: string } } | null
}

/** Authorship remains provenance. Attached evidence belongs to the current
 * active Site owner; unattached reports retain their active creator rule. */
function reportOwnerId(audit: AuditOwnership) {
  if (audit.projectId !== null) return audit.project && !audit.project.deletedAt && audit.project.user.lifecycleStatus === 'ACTIVE'
    ? audit.project.userId : null
  return audit.user?.lifecycleStatus === 'ACTIVE' ? audit.userId : null
}

export function canAccessAudit(
  audit: AuditOwnership & Pick<Audit, 'isPublic'>,
  sessionUser: SessionUser
): boolean {
  if (audit.isPublic) return true
  if (canManageAudit(audit, sessionUser)) return true
  return false
}

export function canManageAudit(
  audit: AuditOwnership,
  sessionUser: SessionUser
): boolean {
  return Boolean(sessionUser?.id && reportOwnerId(audit) === sessionUser.id)
}

/**
 * Anonymous visitors may retry their OWN failed teaser scan, gated on the
 * anonymous-audit cookie (ANON_AUDIT_IDS_COOKIE) instead of userId.
 * Private teasers stay retryable when the signed creator claim lists this id.
 */
export function canRetryAnonymousAudit(
  audit: Pick<Audit, 'userId' | 'isPublic' | 'projectId'>,
  auditId: string,
  anonAuditIds: string[]
): boolean {
  if (audit.userId !== null || audit.projectId !== null) return false
  return anonAuditIds.includes(auditId)
}

