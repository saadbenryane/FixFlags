import { SupportMessageRole } from '@prisma/client'
import { prisma } from '@/lib/db'
import { onBeforeAgentReply } from '@/lib/live-support/types'
import { notifyAdminOfVisitorMessage } from '@/lib/live-support/notify'
import { SupportError } from '@/lib/live-support/errors'
import { logger } from '@/lib/logger'

export async function listMessages(sessionId: string) {
  return prisma.supportMessage.findMany({
    where: { sessionId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      role: true,
      body: true,
      createdAt: true,
      senderId: true,
    },
  })
}

export async function sendVisitorMessage(sessionId: string, body: string) {
  const trimmed = body.trim()
  if (!trimmed) {
    throw new SupportError('Message cannot be empty', 'EMPTY_MESSAGE', 400)
  }

  const message = await prisma.$transaction(async (tx) => {
    const session = await tx.supportSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    })
    if (!session) {
      throw new SupportError('Session not found', 'SESSION_NOT_FOUND', 404)
    }
    if (session.status === 'CLOSED') {
      throw new SupportError('Session is closed', 'SESSION_CLOSED', 409)
    }

    const created = await tx.supportMessage.create({
      data: {
        sessionId,
        role: 'VISITOR',
        body: trimmed,
      },
    })

    await tx.supportSession.update({
      where: { id: sessionId },
      data: {
        lastMessageAt: created.createdAt,
        unreadByAgent: { increment: 1 },
        status: session.status === 'OPEN' ? 'WAITING' : session.status,
      },
    })

    return created
  })

  await notifyAdminOfVisitorMessage(sessionId, trimmed).catch((err) => {
    logger.error('Failed to notify admin of visitor message', err)
  })

  return message
}

export async function sendAgentMessage(sessionId: string, senderId: string, body: string) {
  const trimmed = await onBeforeAgentReply(body.trim())
  if (!trimmed) {
    throw new SupportError('Message cannot be empty', 'EMPTY_MESSAGE', 400)
  }

  return prisma.$transaction(async (tx) => {
    const session = await tx.supportSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    })
    if (!session) {
      throw new SupportError('Session not found', 'SESSION_NOT_FOUND', 404)
    }

    const created = await tx.supportMessage.create({
      data: {
        sessionId,
        role: 'AGENT' satisfies SupportMessageRole,
        body: trimmed,
        senderId,
      },
    })

    await tx.supportSession.update({
      where: { id: sessionId },
      data: {
        lastMessageAt: created.createdAt,
        unreadByVisitor: { increment: 1 },
        status: 'ACTIVE',
        assignedAgentId: senderId,
      },
    })

    return created
  })
}

export async function markReadByVisitor(sessionId: string) {
  await prisma.supportSession.update({
    where: { id: sessionId },
    data: { unreadByVisitor: 0 },
  })
}

export async function markReadByAgent(sessionId: string) {
  await prisma.supportSession.update({
    where: { id: sessionId },
    data: { unreadByAgent: 0 },
  })
}

export function serializeMessage(message: {
  id: string
  role: SupportMessageRole
  body: string
  createdAt: Date
  senderId: string | null
}) {
  return {
    id: message.id,
    role: message.role,
    body: message.body,
    createdAt: message.createdAt.toISOString(),
    senderId: message.senderId,
  }
}

export function serializeSession(session: {
  id: string
  status: string
  visitorName: string | null
  visitorEmail: string | null
  pageUrl: string | null
  lastMessageAt: Date | null
  unreadByVisitor: number
  unreadByAgent: number
  createdAt: Date
}) {
  return {
    id: session.id,
    status: session.status,
    visitorName: session.visitorName,
    visitorEmail: session.visitorEmail,
    pageUrl: session.pageUrl,
    lastMessageAt: session.lastMessageAt?.toISOString() ?? null,
    unreadByVisitor: session.unreadByVisitor,
    unreadByAgent: session.unreadByAgent,
    createdAt: session.createdAt.toISOString(),
  }
}
