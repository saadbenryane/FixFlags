import { prisma } from '@/lib/db'
import { SUPPORT_WELCOME_MESSAGE } from '@/lib/help/sla'
import { getDefaultSupportTenant } from '@/lib/live-support/tenant'
import { resolveLeadIdForSession } from '@/lib/live-support/resolve-lead-context'
import { extractAuditIdFromPageUrl } from '@/lib/live-support/extract-audit-id'
import { sendVisitorMessage } from '@/lib/live-support/messages'
import { notifyAdminOfVisitorMessage } from '@/lib/live-support/notify'
import { logger } from '@/lib/logger'

const ACTIVE_STATUSES = ['OPEN', 'WAITING', 'ACTIVE'] as const

/** Conversations have at least one non-SYSTEM message (lastMessageAt set). */
const HAS_CONVERSATION = { lastMessageAt: { not: null } } as const

export async function resumeOrCreateSession(input: {
  visitorToken: string
  userId?: string | null
  pageUrl?: string | null
  auditId?: string | null
  visitorName?: string | null
  visitorEmail?: string | null
  /** Required to create a new session - never persist empty OPEN rows. */
  firstMessage?: string | null
}) {
  const tenant = await getDefaultSupportTenant()
  const leadId = await resolveLeadIdForSession({
    pageUrl: input.pageUrl,
    userId: input.userId,
    auditId: input.auditId,
  })
  const firstMessage = input.firstMessage?.trim() || null

  const existing = await prisma.supportSession.findFirst({
    where: {
      tenantId: tenant.id,
      visitorToken: input.visitorToken,
      status: { in: [...ACTIVE_STATUSES] },
      ...HAS_CONVERSATION,
    },
    orderBy: { updatedAt: 'desc' },
  })

  if (existing) {
    const session = await prisma.supportSession.update({
      where: { id: existing.id },
      data: {
        pageUrl: input.pageUrl ?? existing.pageUrl,
        leadId: leadId ?? existing.leadId,
        userId: input.userId ?? existing.userId,
        ...(input.visitorName ? { visitorName: input.visitorName } : {}),
        ...(input.visitorEmail ? { visitorEmail: input.visitorEmail } : {}),
      },
    })

    if (firstMessage) {
      await sendVisitorMessage(session.id, firstMessage)
      return prisma.supportSession.findUniqueOrThrow({ where: { id: session.id } })
    }

    return session
  }

  if (!firstMessage) {
    return null
  }

  const session = await prisma.$transaction(async (tx) => {
    const raced = await tx.supportSession.findFirst({
      where: {
        tenantId: tenant.id,
        visitorToken: input.visitorToken,
        status: { in: [...ACTIVE_STATUSES] },
        ...HAS_CONVERSATION,
      },
      orderBy: { updatedAt: 'desc' },
    })

    if (raced) {
      const updated = await tx.supportSession.update({
        where: { id: raced.id },
        data: {
          pageUrl: input.pageUrl ?? raced.pageUrl,
          leadId: leadId ?? raced.leadId,
          userId: input.userId ?? raced.userId,
          ...(input.visitorName ? { visitorName: input.visitorName } : {}),
          ...(input.visitorEmail ? { visitorEmail: input.visitorEmail } : {}),
        },
      })
      const created = await tx.supportMessage.create({
        data: {
          sessionId: updated.id,
          role: 'VISITOR',
          body: firstMessage,
        },
      })
      return tx.supportSession.update({
        where: { id: updated.id },
        data: {
          lastMessageAt: created.createdAt,
          unreadByAgent: { increment: 1 },
          status: updated.status === 'OPEN' ? 'WAITING' : updated.status,
        },
      })
    }

    const createdSession = await tx.supportSession.create({
      data: {
        tenantId: tenant.id,
        visitorToken: input.visitorToken,
        userId: input.userId ?? null,
        pageUrl: input.pageUrl ?? null,
        leadId,
        visitorName: input.visitorName ?? null,
        visitorEmail: input.visitorEmail ?? null,
        status: 'WAITING',
        unreadByAgent: 1,
      },
    })

    await tx.supportMessage.create({
      data: {
        sessionId: createdSession.id,
        role: 'SYSTEM',
        body: SUPPORT_WELCOME_MESSAGE,
      },
    })

    const visitorMsg = await tx.supportMessage.create({
      data: {
        sessionId: createdSession.id,
        role: 'VISITOR',
        body: firstMessage,
      },
    })

    return tx.supportSession.update({
      where: { id: createdSession.id },
      data: { lastMessageAt: visitorMsg.createdAt },
    })
  })

  await notifyAdminOfVisitorMessage(session.id, firstMessage).catch((err) => {
    logger.error('Failed to notify admin of visitor message', err)
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
        ? { status: { in: [...ACTIVE_STATUSES] }, ...HAS_CONVERSATION }
        : { ...HAS_CONVERSATION }

  const sessions = await prisma.supportSession.findMany({
    where: { tenantId: tenant.id, ...statusFilter },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    take: 200,
    include: {
      lead: { select: { normalizedDomain: true, latestScore: true, status: true } },
      user: { select: { email: true, plan: true } },
    },
  })

  const sessionAuditIds = Array.from(
    new Set(
      sessions
        .map((session) => extractAuditIdFromPageUrl(session.pageUrl ?? null))
        .filter((id): id is string => Boolean(id))
    )
  )

  const audits = sessionAuditIds.length
    ? await prisma.audit.findMany({
        where: { id: { in: sessionAuditIds } },
        select: {
          id: true,
          project: {
            select: {
              id: true,
              name: true,
              url: true,
            },
          },
        },
      })
    : []

  const projectByAuditId = new Map(audits.map((audit) => [audit.id, audit.project]))

  return sessions.map((session) => ({
    ...session,
    project: sessionAuditIds.length
      ? projectByAuditId.get(extractAuditIdFromPageUrl(session.pageUrl ?? null) ?? '') ?? null
      : null,
  }))
}

export async function countOpenConversations(): Promise<number> {
  const tenant = await getDefaultSupportTenant()
  return prisma.supportSession.count({
    where: {
      tenantId: tenant.id,
      status: { in: [...ACTIVE_STATUSES] },
      ...HAS_CONVERSATION,
    },
  })
}

export async function closeOrphanSupportSessions(): Promise<number> {
  const tenant = await getDefaultSupportTenant()
  const result = await prisma.supportSession.updateMany({
    where: {
      tenantId: tenant.id,
      status: { in: [...ACTIVE_STATUSES] },
      lastMessageAt: null,
    },
    data: { status: 'CLOSED' },
  })
  return result.count
}

export async function getAdminUnreadCount(): Promise<number> {
  const tenant = await getDefaultSupportTenant()
  const result = await prisma.supportSession.aggregate({
    where: {
      tenantId: tenant.id,
      status: { in: [...ACTIVE_STATUSES] },
      ...HAS_CONVERSATION,
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
