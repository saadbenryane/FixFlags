import { NextRequest, NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'
import { apiError, handleRouteError } from '@/lib/api/errors'
import { enforceRateLimit, requestClientId } from '@/lib/security/rate-limit'
import { prisma } from '@/lib/db'
import { getEnv } from '@/lib/env'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'
import { loadProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { productNameFromUrl } from '@/lib/audit/product-intelligence'
import {
  answerProductQuestion,
  buildCannedChatReply,
  isWorkspaceChatConfigured,
  runWorkspaceChat,
  type ChatDiffItem,
  type ChatDiffSummary,
  type ChatFlagContext,
  type ChatVerifiedLearning,
} from '@/lib/workspace/chat'

const schema = z.object({
  message: z.string().min(1).max(2000),
  observationAuditId: z.string().min(1).max(64).optional().nullable(),
})

const MAX_CHAT_FLAGS = 15
const MAX_HISTORY_MESSAGES = 40
const CHAT_SESSION_CAP = 20
const MAX_PARENT_HOPS = 60

function chatSessionCap(): number {
  const configured = Number(getEnv().CHAT_SESSION_CAP)
  return configured > 0 ? configured : CHAT_SESSION_CAP
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
  return { session, audit }
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

    const productAnswer = answerProductQuestion({
      message: parsed.data.message,
      flags,
      diff,
      learnings,
      productName,
    })

    let reply: string
    let mode: 'llm' | 'canned'
    if (productAnswer) {
      reply = productAnswer.reply
      mode = 'canned'
    } else {
      const result = await runWorkspaceChat({
        message: parsed.data.message,
        url: observation.url,
        status: observation.status,
        flags,
      })
      reply = result.reply
      mode = result.mode
    }

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
