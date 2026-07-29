import type { User } from '@prisma/client'
import { prisma } from '@/lib/db'
import { canAccessAudit } from '@/lib/audit/access'
import { canSharePublicly } from '@/lib/auth/entitlements'

export async function assertMcpAccess(user: User): Promise<User> {
  const fresh = await prisma.user.findUnique({ where: { id: user.id } })
  if (!fresh) {
    throw new Error('User not found')
  }
  return fresh
}

export async function assertAuditAccess(
  audit: { userId: string | null; isPublic: boolean },
  userId: string,
  message = 'Unauthorized'
): Promise<void> {
  if (!canAccessAudit(audit, { id: userId })) throw new Error(message)
  if (audit.userId === userId || !audit.userId) return

  const owner = await prisma.user.findUnique({
    where: { id: audit.userId },
    select: { id: true, role: true, plan: true, subscriptionStatus: true },
  })
  if (!owner || !canSharePublicly(owner)) throw new Error(message)
}
