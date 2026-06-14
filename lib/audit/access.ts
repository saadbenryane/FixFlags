import { Audit } from '@prisma/client'

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
