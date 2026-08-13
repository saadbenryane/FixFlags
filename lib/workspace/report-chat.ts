import { prisma } from '@/lib/db'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import type { FlagDiffSummaryItem } from '@/lib/audit/flag-types'
import { loadProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { productNameFromUrl } from '@/lib/audit/product-intelligence'
import type { AgentMessage } from '@/lib/audit/agent-message'
import {
  answerProductQuestion,
  isWorkspaceChatConfigured,
  runWorkspaceChat,
  workspaceChatTokenUpperBound,
  type ChatDiffItem,
  type ChatDiffSummary,
  type ChatFlagContext,
  type ChatVerifiedLearning,
} from '@/lib/workspace/chat'
import {
  finalizeChatUsage,
  getChatAllowance,
  releaseChatUsage,
  reserveChatUsage,
} from '@/lib/billing/chat-usage'

const MAX_CHAT_FLAGS = 15
const MAX_HISTORY_MESSAGES = 40
const MAX_PARENT_HOPS = 60

type AuditRow = {
  id: string
  userId: string | null
  url: string
  status: string
  parentId: string | null
  projectId: string | null
}

export class ReportChatServiceError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly action?: string,
    readonly details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ReportChatServiceError'
  }
}

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
    },
  })
}

async function requireAuditOwner(auditId: string, userId: string) {
  const audit = await getAudit(auditId)
  if (!audit) throw new ReportChatServiceError('Report not found', 404)
  if (audit.userId !== userId) {
    throw new ReportChatServiceError('You can only chat on your own reports', 403)
  }
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, plan: true, role: true, subscriptionStatus: true },
  })
  if (!user) throw new ReportChatServiceError('Account not found', 401)
  return { audit, user }
}

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

async function resolveObservation(input: {
  observationId: string
  reportAuditId: string
  userId: string
}): Promise<AuditRow> {
  const observation = await getAudit(input.observationId)
  if (!observation) throw new ReportChatServiceError('Observation not found', 404)
  if (observation.userId !== input.userId) {
    throw new ReportChatServiceError('You can only chat on your own reports', 403)
  }
  const [reportRoot, observationRoot] = await Promise.all([
    releaseRootAuditId(input.reportAuditId),
    releaseRootAuditId(input.observationId),
  ])
  if (!reportRoot || !observationRoot || reportRoot !== observationRoot) {
    throw new ReportChatServiceError('That observation is not part of this report', 400)
  }
  return observation
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

export async function getReportChatHistory(input: {
  auditId: string
  userId: string
  observationAuditId?: string | null
}) {
  const owned = await requireAuditOwner(input.auditId, input.userId)
  if (input.observationAuditId && input.observationAuditId !== input.auditId) {
    await resolveObservation({
      observationId: input.observationAuditId,
      reportAuditId: input.auditId,
      userId: input.userId,
    })
  }

  const messages = (await prisma.reportChatMessage.findMany({
    where: { auditId: input.auditId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: MAX_HISTORY_MESSAGES,
    select: { id: true, role: true, content: true, createdAt: true },
  })).reverse()

  return {
    messages: messages.map((message) => ({ role: message.role, content: message.content })),
    agentMessages: messages.map((message) =>
      toConversationEnvelope({ ...message, auditId: input.auditId })
    ),
    available: isWorkspaceChatConfigured(),
    allowance: await getChatAllowance(owned.user),
  }
}

export async function sendReportChatMessage(input: {
  auditId: string
  userId: string
  message: string
  observationAuditId?: string | null
}) {
  const owned = await requireAuditOwner(input.auditId, input.userId)
  const observationId = input.observationAuditId ?? input.auditId
  const observation = observationId === input.auditId
    ? owned.audit
    : await resolveObservation({
        observationId,
        reportAuditId: input.auditId,
        userId: input.userId,
      })

  const { flags, diff, learnings, productName } = await loadObservationContext(observation)
  const productAnswer = answerProductQuestion({
    message: input.message,
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
      message: input.message,
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
      throw new ReportChatServiceError(
        'Chat allowance exhausted',
        429,
        'CHAT_ALLOWANCE_EXHAUSTED',
        undefined,
        { allowance }
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
      { auditId: input.auditId, userId: input.userId, role: 'user', content: input.message },
      { auditId: input.auditId, userId: input.userId, role: 'assistant', content: reply },
    ],
  })

  return {
    reply,
    agentMessage: toConversationEnvelope({
      id: `${Date.now()}:agent`,
      auditId: input.auditId,
      role: 'assistant',
      content: reply,
    }),
    mode,
    allowance,
  }
}
