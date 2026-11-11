import { resolveAuditAccess } from '@/lib/audit/access'

export async function assertAuditAccess(
  audit: { id: string; userId: string | null; isPublic: boolean },
  userId: string,
  message = 'Unauthorized'
): Promise<void> {
  if (await resolveAuditAccess(audit, { id: userId }) === 'denied') throw new Error(message)
}
