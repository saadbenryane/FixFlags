import { prisma } from '@/lib/db'
import { SUPPORT_WELCOME_MESSAGE } from '@/lib/help/sla'
import { getDefaultSupportTenant } from '@/lib/live-support/tenant'
import { resolveLeadIdForSession } from '@/lib/live-support/resolve-lead-context'

const ACTIVE_STATUSES = ['OPEN', 'WAITING', 'ACTIVE'] as const

export async function resumeOrCreateSession(input: {
  visitorToken: string
  userId?: string | null
  pageUrl?: string | null
  auditId?: string | null
  visitorName?: string | null
  visitorEmail?: string | null
}) {
  const tenant = await getDefaultSupportTenant()
  const leadId = await resolveLeadIdForSession({
    pageUrl: input.pageUrl,
    userId: input.userId,
    auditId: input.auditId,
  })

  const existing = await prisma.supportSession.findFirst({
    where: {
      tenantId: tenant.id,
      visitorToken: input.visitorToken,
      status: { in: [...ACTIVE_STATUSES] },
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (existing) {
    return prisma.supportSession.update({
      where: { id: existing.id },
      data: {
        pageUrl: input.pageUrl ?? existing.pageUrl,
        leadId: leadId ?? existing.leadId,
        userId: input.userId ?? existing.userId,
        ...(input.visitorName ? { visitorName: input.visitorName } : {}),
        ...(input.visitorEmail ? { visitorEmail: input.visitorEmail } : {}),
      },
    })
  }

  const session = await prisma.supportSession.create({
    data: {
      tenantId: tenant.id,
      visitorToken: input.visitorToken,
      userId: input.userId ?? null,
      pageUrl: input.pageUrl ?? null,
      leadId,
      visitorName: input.visitorName ?? null,
      visitorEmail: input.visitorEmail ?? null,
      status: 'OPEN',
    },
  })

  await prisma.supportMessage.create({
    data: {
      sessionId: session.id,
      role: 'SYSTEM',
      body: SUPPORT_WELCOME_MESSAGE,
    },
  })

  return session
}

export async function getSessionForVisitor(sessionId: string, visitorToken: string) {
  return prisma.supportSession.findFirst({
    where: { id: sessionId, visitorToken },
  })
}

export async function listAdminSessions(filter?: 'open' | 'closed' | 'all') {
  const tenant = await getDefaultSupportTenant()
  const statusFilter =
    filter === 'closed'
      ? { status: 'CLOSED' as const }
      : filter === 'open'
        ? { status: { in: [...ACTIVE_STATUSES] } }
        : {}

  return prisma.supportSession.findMany({
    where: { tenantId: tenant.id, ...statusFilter },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: {
      lead: { select: { normalizedDomain: true, latestScore: true, status: true } },
      user: { select: { email: true, plan: true } },
    },
  })
}

export async function getAdminUnreadCount(): Promise<number> {
  const tenant = await getDefaultSupportTenant()
  const result = await prisma.supportSession.aggregate({
    where: {
      tenantId: tenant.id,
      status: { in: [...ACTIVE_STATUSES] },
    },
    _sum: { unreadByAgent: true },
  })
  return result._sum.unreadByAgent ?? 0
}

export async function updateSessionStatus(
  sessionId: string,
  status: 'OPEN' | 'WAITING' | 'ACTIVE' | 'CLOSED',
  assignedAgentId?: string | null
) {
  return prisma.supportSession.update({
    where: { id: sessionId },
    data: {
      status,
      ...(assignedAgentId !== undefined ? { assignedAgentId } : {}),
    },
  })
}
