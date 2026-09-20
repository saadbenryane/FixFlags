import { prisma } from '@/lib/db'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { loadProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { isCustomerFlag } from '@/lib/audit/attention'
import {
  answerProductQuestion,
  runWorkspaceChat,
  workspaceChatTokenUpperBound,
  type ChatDiffSummary,
  type ChatFlagContext,
  type ChatImprovementContext,
} from '@/lib/workspace/chat'
import { finalizeChatUsage, releaseChatUsage, reserveChatUsage } from '@/lib/billing/chat-usage'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'

const MAX_MESSAGES = 40

function minimizeStoredMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/\b(api[-_ ]?key|token|password|secret)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .slice(0, 2000)
}

export type AgentCitation = {
  type: 'flag' | 'attempt' | 'watch'
  id: string
  label: string
  href: string
}

export class SiteAgentError extends Error {
  constructor(message: string, readonly status: number, readonly code?: string) {
    super(message)
    this.name = 'SiteAgentError'
  }
}

async function requireOwnedSite(siteId: string, userId: string) {
  const project = await prisma.project.findFirst({
    where: { id: siteId, userId, deletedAt: null },
    select: {
      id: true,
      url: true,
      canonicalHost: true,
      watchInterval: true,
      watchLastRunAt: true,
      watchLastError: true,
      user: { select: { id: true, role: true, plan: true, subscriptionStatus: true } },
      audits: {
        where: { status: 'COMPLETED' },
        orderBy: { completedAt: 'desc' },
        take: 1,
        select: { id: true, parentId: true, status: true },
      },
      improvements: {
        orderBy: [{ priority: 'desc' }, { updatedAt: 'desc' }],
        take: 12,
        include: {
          occurrences: { orderBy: { createdAt: 'desc' }, take: 1, include: { flag: true } },
          attempts: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
      },
    },
  })
  if (!project) throw new SiteAgentError('Site not found', 404)
  return project
}

async function getOrCreateThread(projectId: string, userId: string) {
  const existing = await prisma.siteAgentThread.findFirst({
    where: { projectId, userId },
    orderBy: { updatedAt: 'desc' },
  })
  return existing ?? prisma.siteAgentThread.create({ data: { projectId, userId } })
}

export async function getSiteAgentHistory(input: { siteId: string; userId: string }) {
  await requireOwnedSite(input.siteId, input.userId)
  const thread = await prisma.siteAgentThread.findFirst({
    where: { projectId: input.siteId, userId: input.userId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' }, take: MAX_MESSAGES } },
  })
  return {
    threadId: thread?.id ?? null,
    messages: (thread?.messages ?? []).map((message) => ({
      id: message.id,
      role: message.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: message.content,
      citations: (message.citations ?? []) as unknown as AgentCitation[],
      createdAt: message.createdAt.toISOString(),
    })),
  }
}

export async function sendSiteAgentMessage(input: { siteId: string; userId: string; message: string }) {
  const project = await requireOwnedSite(input.siteId, input.userId)
  const latest = project.audits[0] ?? null
  const flags: ChatFlagContext[] = project.improvements.flatMap((improvement) => {
    const flag = improvement.occurrences[0]?.flag
    if (!flag || !isCustomerFlag({ ...flag, status: improvement.status })) return []
    return [{
      id: improvement.id,
      checkId: flag.checkId,
      rubric: flag.rubric,
      severity: flag.severity,
      problem: improvement.title,
      evidence: flag.evidence,
      fix: improvement.recommendedChange,
      status: improvement.status === 'VERIFIED' ? 'FIXED' : flag.status,
      position: flag.position,
    }]
  })
  const improvements: ChatImprovementContext[] = project.improvements.map((improvement) => ({
    id: improvement.id,
    title: improvement.title,
    judgment: improvement.judgment,
    recommendedChange: improvement.recommendedChange,
    successCondition: improvement.successCondition,
    status: improvement.status,
    latestOutcome: improvement.attempts[0]?.outcome ?? null,
  }))
  const diff: ChatDiffSummary = latest?.parentId
    ? await getFlagDiffSummary(latest.parentId, latest.id).then((summary) => ({
        hasParent: true,
        fixed: summary.fixed,
        regressed: summary.regressed,
        newIssues: summary.newIssues,
      }))
    : { hasParent: false, fixed: [], regressed: [], newIssues: [] }
  const learnings = (await loadProjectIntelligence(project.id))?.verifiedLearnings ?? []
  const deterministic = answerProductQuestion({
    message: input.message,
    flags,
    diff,
    learnings,
    productName: project.canonicalHost,
    improvements,
  })

  let reply: string
  if (deterministic) {
    reply = deterministic.reply
  } else {
    const context = {
      message: input.message,
      url: project.url,
      status: latest?.status ?? 'No completed check',
      flags,
      improvements,
    }
    const reservation = await reserveChatUsage(project.user, workspaceChatTokenUpperBound(context))
    if (!reservation.reservationId) {
      throw new SiteAgentError('Agent allowance exhausted for this month.', 429, 'AGENT_ALLOWANCE_EXHAUSTED')
    }
    let reservationId: string | null = reservation.reservationId
    try {
      const result = await runWorkspaceChat(context)
      reply = result.reply
      await finalizeChatUsage(reservationId, result.usage)
      reservationId = null
    } finally {
      if (reservationId) await releaseChatUsage(reservationId)
    }
  }

  const citations: AgentCitation[] = flags.slice(0, 3).map((flag) => ({
    type: 'flag',
    id: flag.id,
    label: flag.problem,
    href: `/sites/${project.id}/flags/${flag.id}`,
  }))
  if (project.watchLastRunAt || project.watchLastError) {
    citations.push({ type: 'watch', id: project.id, label: 'Watch status', href: `/sites/${project.id}/settings` })
  }

  const thread = await getOrCreateThread(project.id, input.userId)
  const storedMessage = minimizeStoredMessage(input.message)
  const [, assistant] = await prisma.$transaction([
    prisma.siteAgentMessage.create({
      data: { threadId: thread.id, userId: input.userId, role: 'USER', content: storedMessage },
    }),
    prisma.siteAgentMessage.create({
      data: { threadId: thread.id, userId: input.userId, role: 'ASSISTANT', content: reply, citations },
    }),
    prisma.siteAgentThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } }),
  ])
  await recordSiteLifecycleEvent({
    name: 'agent_answered',
    idempotencyKey: `agent-answered:${assistant.id}`,
    userId: input.userId,
    projectId: project.id,
    properties: { deterministic: Boolean(deterministic), citationCount: citations.length },
  })

  return { reply, citations, messageId: assistant.id, threadId: thread.id }
}
