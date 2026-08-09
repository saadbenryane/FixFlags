import { prisma } from '@/lib/db'
import { authorizeCanvasAccess } from '@/lib/canvas/authorization'

export type CanvasReportAccess =
  | { allowed: true; audit: { id: string; projectId: string; userId: string }; user: { id: string; role: string; plan: 'FREE' | 'BUILDER' | 'TEAM'; subscriptionStatus: 'NONE' | 'ACTIVE' | 'TRIALING' | 'PAST_DUE' | 'CANCELED' | 'UNPAID' } }
  | { allowed: false; reason: 'AUTH_REQUIRED' | 'OWNER_REQUIRED' | 'PAID_PLAN_REQUIRED' | 'REPORT_NOT_FOUND' | 'PROJECT_REQUIRED' }

export async function resolveCanvasReportAccess(
  auditId: string,
  actorId: string | null | undefined
): Promise<CanvasReportAccess> {
  const audit = await prisma.audit.findUnique({
    where: { id: auditId },
    select: { id: true, userId: true, projectId: true },
  })
  if (!audit) return { allowed: false, reason: 'REPORT_NOT_FOUND' }
  if (!actorId) return { allowed: false, reason: 'AUTH_REQUIRED' }
  if (!audit.userId) return { allowed: false, reason: 'OWNER_REQUIRED' }
  if (!audit.projectId) return { allowed: false, reason: 'PROJECT_REQUIRED' }
  const user = await prisma.user.findUnique({
    where: { id: actorId },
    select: { id: true, role: true, plan: true, subscriptionStatus: true },
  })
  if (!user) return { allowed: false, reason: 'AUTH_REQUIRED' }
  const decision = authorizeCanvasAccess({ actor: user, projectOwnerId: audit.userId })
  if (!decision.allowed) return decision
  return {
    allowed: true,
    audit: { id: audit.id, projectId: audit.projectId, userId: audit.userId },
    user,
  }
}
