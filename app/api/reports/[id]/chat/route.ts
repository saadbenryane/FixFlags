import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import {
  buildCannedChatReply,
  isWorkspaceChatConfigured,
  runWorkspaceChat,
  type ChatFlagContext,
} from '@/lib/workspace/chat'

const schema = z.object({
  message: z.string().min(1).max(2000),
})

const MAX_CHAT_FLAGS = 15
const MAX_HISTORY_MESSAGES = 40
const CHAT_SESSION_CAP = 20

function chatSessionCap(): number {
  const configured = Number(getEnv().CHAT_SESSION_CAP)
  return configured > 0 ? configured : CHAT_SESSION_CAP
}

async function getAudit(id: string) {
  return prisma.audit.findUnique({
    where: { id },
    select: { id: true, userId: true, url: true, status: true },
  })
}

async function loadFlagContext(auditId: string): Promise<ChatFlagContext[]> {
  const flags = await prisma.flag.findMany({
    where: { auditId },
    orderBy: [{ position: 'asc' }],
    take: MAX_CHAT_FLAGS,
    select: { id: true, rubric: true, severity: true, problem: true, evidence: true, fix: true },
  })
  return flags.map((flag) => ({
    id: flag.id,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    evidence: flag.evidence,
    fix: flag.fix,
  }))
}

async function requireAuditOwner(auditId: string) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user?.id) {
    return { error: apiError('Sign in to use workspace chat', 401, { code: 'UNAUTHORIZED' }) }
  }
  const audit = await getAudit(auditId)
  if (!audit) return { error: apiError('Report not found', 404) }
  if (audit.userId !== session.user.id) {
    return { error: apiError('You can only chat on your own reports', 403) }
  }
  return { session, audit }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params
    const owned = await requireAuditOwner(auditId)
    if (owned.error) return owned.error
    if (!owned.session) return apiError('Sign in to use workspace chat', 401)

    const messages = await prisma.reportChatMessage.findMany({
      where: { auditId },
      orderBy: { createdAt: 'asc' },
      take: MAX_HISTORY_MESSAGES,
      select: { role: true, content: true, createdAt: true },
    })
    const userTurns = await prisma.reportChatMessage.count({
      where: { auditId, role: 'user' },
    })

    return NextResponse.json({
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      available: isWorkspaceChatConfigured(),
      cap: chatSessionCap(),
      userTurns,
    })
  } catch (error) {
    return handleRouteError(error, 'Chat history unavailable')
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await enforceRateLimit({
      scope: 'workspace_chat',
      identifier: requestClientId(req.headers),
      limit: 20,
      windowSeconds: 60,
      onRedisDown: 'reject',
    })

    const { id: auditId } = await params
    const owned = await requireAuditOwner(auditId)
    if (owned.error) return owned.error
    if (!owned.session || !owned.audit) {
      return apiError('Sign in to use workspace chat', 401)
    }

    const body = await req.json().catch(() => ({}))
    const parsed = schema.safeParse(body)
    if (!parsed.success) return apiError('Message required', 400)

    const flags = await loadFlagContext(auditId)
    const cap = chatSessionCap()
    const userMessageCount = await prisma.reportChatMessage.count({
      where: { auditId, role: 'user' },
    })
    if (userMessageCount >= cap) {
      return NextResponse.json({
        reply: buildCannedChatReply({ flags }),
        mode: 'canned',
        capReached: true,
        cap,
      })
    }

    await prisma.reportChatMessage.create({
      data: {
        auditId,
        userId: owned.session.user.id,
        role: 'user',
        content: parsed.data.message,
      },
    })

    const { reply, mode } = await runWorkspaceChat({
      message: parsed.data.message,
      url: owned.audit.url,
      status: owned.audit.status,
      flags,
    })

    await prisma.reportChatMessage.create({
      data: {
        auditId,
        userId: owned.session.user.id,
        role: 'assistant',
        content: reply,
      },
    })

    return NextResponse.json({ reply, mode, cap, userTurns: userMessageCount + 1 })
  } catch (error) {
    return handleRouteError(error, 'Chat unavailable')
  }
}
