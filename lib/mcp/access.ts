import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { resolveAuditAccess } from '@/lib/audit/access'

export async function assertMcpAccess(user: User): Promise<User> {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh) {
    throw new Error('User not found')
  }
  return fresh
}

export async function assertAuditAccess(
  audit: { id: string; userId: string | null; isPublic: boolean },
  userId: string,
  message = 'Unauthorized'
): Promise<void> {
  if (await resolveAuditAccess(audit, { id: userId }) === 'denied') throw new Error(message)
}
