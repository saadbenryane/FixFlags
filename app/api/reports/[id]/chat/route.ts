import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'
import { loadProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { productNameFromUrl } from '@/lib/audit/product-intelligence'
import {
  answerProductQuestion,
  isWorkspaceChatConfigured,
  runWorkspaceChat,
  workspaceChatTokenUpperBound,
  WorkspaceChatUnavailableError,
  type ChatDiffItem,
  type ChatDiffSummary,
  type ChatFlagContext,
  type ChatVerifiedLearning,
} from '@/lib/workspace/chat'
import type { AgentMessage } from '@/lib/audit/agent-message'
import {
  getChatAllowance,
  reserveChatUsage,
  finalizeChatUsage,
  releaseChatUsage,
} from '@/lib/billing/chat-usage'

const schema = z.object({
  message: z.string().min(1).max(2000),
  observationAuditId: z.string().min(1).max(64).optional().nullable(),
})

const MAX_CHAT_FLAGS = 15
const MAX_HISTORY_MESSAGES = 40
const MAX_PARENT_HOPS = 60

function toConversationEnvelope(input: {
  id: string
  auditId: string
  role: string
  content: string
  createdAt?: Date
}): AgentMessage {
  const isUser = input.role === 'user'
  return {
    id: `chat:${input.id}`,
    sessionId: input.auditId,
    auditId: input.auditId,
    role: isUser ? 'user' : 'agent',
    source: isUser ? 'user' : 'model',
    kind: 'conversation',
    content: input.content,
    createdAt: input.createdAt?.toISOString(),
  }
}

type AuditRow = {
  id: string
  userId: string | null
  url: string
  status: string
  parentId: string | null
  projectId: string | null
  productContract: unknown
}

async function getAudit(id: string): Promise<AuditRow | null> {
  return prisma.audit.findUnique({
    where: { id },
    select: {
      id: true,
      userId: true,
      url: true,
      status: true,
      parentId: true,
      projectId: true,
      productContract: true,
    },
  })
}

async function loadFlagContext(auditId: string): Promise<ChatFlagContext[]> {
  const flags = await prisma.flag.findMany({
    where: { auditId },
    orderBy: [{ position: 'asc' }],
    take: MAX_CHAT_FLAGS,
    select: {
      id: true,
      checkId: true,
      rubric: true,
      severity: true,
      problem: true,
      evidence: true,
      fix: true,
      status: true,
      position: true,
    },
  })
  return flags.map((flag) => ({
    id: flag.id,
    checkId: flag.checkId,
    rubric: flag.rubric,
    severity: flag.severity,
    problem: flag.problem,
    evidence: flag.evidence,
    fix: flag.fix,
    status: flag.status,
    position: flag.position,
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
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, plan: true, role: true, subscriptionStatus: true },
  })
  if (!user) return { error: apiError('Account not found', 401) }
  return { session, audit, user }
}

/**
 * Walk the parentId chain to the root review of a release spine. The spine
 * is how the workspace groups observations of one product.
 */
async function releaseRootAuditId(auditId: string): Promise<string | null> {
  let cursorId: string | null = auditId
  let hops = 0
  while (cursorId && hops < MAX_PARENT_HOPS) {
    const row: { parentId: string | null } | null = await prisma.audit.findUnique({
      where: { id: cursorId },
      select: { parentId: true },
    })
    if (!row) return null
    if (!row.parentId) return cursorId
    cursorId = row.parentId
    hops += 1
  }
  return cursorId
}

/**
 * Resolve the observation audit that grounds chat answers. It must belong to
 * the signed-in user and share the same release spine as the report, so chat
 * grounding can never drift to another product's observation.
 */
async function resolveObservation(input: {
  observationId: string
  reportAuditId: string
  userId: string
}): Promise<{ audit: AuditRow } | { error: NextResponse }> {
  const { observationId, reportAuditId, userId } = input
  const observation = await getAudit(observationId)
  if (!observation) return { error: apiError('Observation not found', 404) }
  if (observation.userId !== userId) {
    return { error: apiError('You can only chat on your own reports', 403) }
  }
  const reportRoot = await releaseRootAuditId(reportAuditId)
  const observationRoot = await releaseRootAuditId(observationId)
  if (!reportRoot || !observationRoot || reportRoot !== observationRoot) {
    return { error: apiError('That observation is not part of this report', 400) }
  }
  return { audit: observation }
}

function toChatDiffItem(item: FlagDiffSummaryItem): ChatDiffItem {
  return { problem: item.problem, rubric: item.rubric, severity: item.severity }
}

async function loadObservationContext(observation: AuditRow): Promise<{
  flags: ChatFlagContext[]
  diff: ChatDiffSummary
  learnings: ChatVerifiedLearning[]
  productName: string
}> {
  const [flags, diff, learnings] = await Promise.all([
    loadFlagContext(observation.id),
    observation.parentId
      ? getFlagDiffSummary(observation.parentId, observation.id).then((summary) => ({
          hasParent: true,
          fixed: summary.fixed.map(toChatDiffItem),
          regressed: summary.regressed.map(toChatDiffItem),
          newIssues: summary.newIssues.map(toChatDiffItem),
        }))
      : Promise.resolve<ChatDiffSummary>({
          hasParent: false,
          fixed: [],
          regressed: [],
          newIssues: [],
        }),
    observation.projectId
      ? loadProjectIntelligence(observation.projectId).then(
          (intelligence) => intelligence?.verifiedLearnings ?? []
        )
      : Promise.resolve<ChatVerifiedLearning[]>([]),
  ])
  return { flags, diff, learnings, productName: productNameFromUrl(observation.url) }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: auditId } = await params
    const owned = await requireAuditOwner(auditId)
    if (owned.error) return owned.error
    if (!owned.session) return apiError('Sign in to use workspace chat', 401)

    const observationId = req.nextUrl.searchParams.get('observationAuditId')
    if (observationId && observationId !== auditId) {
      const resolved = await resolveObservation({
        observationId,
        reportAuditId: auditId,
        userId: owned.session.user.id,
      })
      if ('error' in resolved) return resolved.error
    }

    const messages = (await prisma.reportChatMessage.findMany({
      where: { auditId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: MAX_HISTORY_MESSAGES,
      select: { id: true, role: true, content: true, createdAt: true },
    })).reverse()
    const allowance = await getChatAllowance(owned.user)

    return NextResponse.json({
      messages: messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
      agentMessages: messages.map((message) => toConversationEnvelope({
        ...message,
        auditId,
      })),
      available: isWorkspaceChatConfigured(),
      allowance,
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

    // Grounding follows the selected spine observation; message history stays
    // keyed to the report's own auditId so one conversation persists per report.
    const observationId = parsed.data.observationAuditId ?? auditId
    let observation: AuditRow = owned.audit
    if (observationId !== auditId) {
      const resolved = await resolveObservation({
        observationId,
        reportAuditId: auditId,
        userId: owned.session.user.id,
      })
      if ('error' in resolved) return resolved.error
      observation = resolved.audit
    }

    const { flags, diff, learnings, productName } = await loadObservationContext(observation)
    const productAnswer = answerProductQuestion({
      message: parsed.data.message,
      flags,
      diff,
      learnings,
      productName,
    })

    let reply: string
    let mode: 'llm' | 'canned'
    let allowance = await getChatAllowance(owned.user)
    let reservationId: string | null = null
    if (productAnswer) {
      reply = productAnswer.reply
      mode = 'canned'
    } else {
      const chatInput = {
        message: parsed.data.message,
        url: observation.url,
        status: observation.status,
        flags,
      }
      const reservation = await reserveChatUsage(
        owned.user,
        workspaceChatTokenUpperBound(chatInput)
      )
      allowance = reservation.allowance
      reservationId = reservation.reservationId
      if (!reservationId) {
        return NextResponse.json(
          { code: 'CHAT_ALLOWANCE_EXHAUSTED', allowance },
          { status: 429 }
        )
      }
      try {
        const result = await runWorkspaceChat(chatInput)
        reply = result.reply
        mode = result.mode
        allowance = await finalizeChatUsage(reservationId, result.usage)
        reservationId = null
      } finally {
        if (reservationId) await releaseChatUsage(reservationId)
      }
    }

    await prisma.reportChatMessage.createMany({
      data: [
        { auditId, userId: owned.session.user.id, role: 'user', content: parsed.data.message },
        { auditId, userId: owned.session.user.id, role: 'assistant', content: reply },
      ],
    })

    const agentMessage = toConversationEnvelope({
      id: `${Date.now()}:agent`,
      auditId,
      role: 'assistant',
      content: reply,
    })
    return NextResponse.json({ reply, agentMessage, mode, allowance })
  } catch (error) {
    if (error instanceof WorkspaceChatUnavailableError) {
      return apiError('Chat is temporarily unavailable. Try again.', 503, {
        code: 'CHAT_UNAVAILABLE',
        action: 'retry',
      })
    }
    return handleRouteError(error, 'Chat unavailable')
  }
}
