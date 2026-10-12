import { authorizeAgentCitations } from './agent-citations'
import { SiteAgentError, type AgentCitation } from '@/lib/sites/agent-contract'
import { admitAgentMessage, completeAgentMessage, replayAgentMessage, saveAgentReply, recoverAgentReplies } from './agent-intents'
import { siteWideAnalysisAuditWhere } from './analysis-scope'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { prisma } from '@/lib/db'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { loadProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { isCustomerFlag } from '@/lib/audit/attention'
import {
  answerProductQuestion,
  runWorkspaceChat,
  WorkspaceChatUnavailableError,
  workspaceChatTokenUpperBound,
  type ChatDiffSummary,
  type ChatFlagContext,
  type ChatImprovementContext,
} from '@/lib/workspace/chat'
import { finalizeChatUsage, releaseChatUsage, reserveChatUsage } from '@/lib/billing/chat-usage'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { SITE_AGENT_COPY } from '@/lib/marketing/copy/site-agent'

const MAX_MESSAGES = 40

function minimizeStoredMessage(message: string): string {
  return message
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .replace(/\b(api[-_ ]?key|token|password|secret)\s*[:=]\s*\S+/gi, '$1: [redacted]')
    .slice(0, 2000)
}

export { SiteAgentError } from '@/lib/sites/agent-contract'
export type { AgentCitation } from '@/lib/sites/agent-contract'
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
        where: { status: 'COMPLETED', ...siteWideAnalysisAuditWhere },
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

export async function getSiteAgentHistory(input: { siteId: string; userId: string }) {
  await requireOwnedSite(input.siteId, input.userId)
  await recoverAgentReplies(input.siteId, input.userId)
  const thread = await prisma.siteAgentThread.findFirst({
    where: { projectId: input.siteId, userId: input.userId },
    orderBy: { updatedAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'desc' }, take: MAX_MESSAGES, include: { intent: { select: { flagId: true, requestKey: true } } } } },
  })
  const citations = await authorizeAgentCitations(input.siteId, (thread?.messages ?? []).map(message => message.citations))
  return {
    threadId: thread?.id ?? null,
    messages: (thread?.messages ?? []).toReversed().map((message) => ({
      id: message.id,
      role: message.role === 'USER' ? 'user' as const : 'assistant' as const,
      content: message.content,
      citations: citations(message.citations),
      flagId: message.intent?.flagId ?? null,
      requestKey: message.intent?.requestKey ?? null,
      createdAt: message.createdAt.toISOString(),
    })),
  }
}

export async function sendSiteAgentMessage(input: { siteId: string; userId: string; message: string; requestKey: string; flagId?: string }) {
  const project = await requireOwnedSite(input.siteId, input.userId)
  await recoverAgentReplies(project.id, input.userId)
  const selectedFlag = input.flagId ? await loadSiteRecord(input.siteId).then(site => site ? loadSiteFlagDetail(site, input.flagId!) : null) : null
  if (input.flagId && !selectedFlag) throw new SiteAgentError('Flag not found', 404)
  const admitted = await admitAgentMessage({ ...input, projectId: project.id, storedMessage: minimizeStoredMessage(input.message) })
  if (!admitted.created) return replayAgentMessage(admitted.intent, input.userId)
  try {
  // Greeting-only messages use authorized context and the same durable receipt path.
  if (/^(?:hi|hello|hey)[\s!.,?]*$/i.test(input.message.trim())) {
    const reply = SITE_AGENT_COPY.greeting(project.canonicalHost, selectedFlag?.problem)
    const ready = await saveAgentReply(admitted.intent.id, { reply, citations: [], usage: null })
    const response = await completeAgentMessage(ready, input.userId)
    await recordSiteLifecycleEvent({ name: 'agent_answered', idempotencyKey: `agent-answered:${response.messageId}`,
      userId: input.userId, projectId: project.id, properties: { deterministic: true, citationCount: 0 } }).catch(() => undefined)
    return response
  }
  const priorMessages = await prisma.siteAgentMessage.findMany({ where: { threadId: admitted.intent.threadId, intentId: { not: admitted.intent.id } },
    orderBy: { createdAt: 'desc' }, take: 6, select: { role: true, content: true } })
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
  if (selectedFlag) {
    flags.splice(0, flags.length, { id: selectedFlag.id, checkId: selectedFlag.checkId, rubric: selectedFlag.rubric, severity: selectedFlag.severity,
      problem: selectedFlag.problem, evidence: selectedFlag.evidence, fix: selectedFlag.fix, status: selectedFlag.status, position: 0 })
  }
  const improvements: ChatImprovementContext[] = project.improvements.filter(improvement => !selectedFlag || improvement.id === selectedFlag.improvementId).map((improvement) => ({
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
  let usage: { inputTokens: number; outputTokens: number; model?: string } | null = null
  if (deterministic) {
    reply = deterministic.reply
  } else {
    const context = {
      message: input.message,
      url: project.url,
      status: latest?.status ?? 'No completed check',
      flags,
      improvements,
      conversation: priorMessages.toReversed().map(message => ({ role: message.role === 'USER' ? 'user' as const : 'assistant' as const, content: message.content })),
    }
    const reservation = await reserveChatUsage(project.user, workspaceChatTokenUpperBound(context))
    if (!reservation.reservationId) {
      throw new SiteAgentError('Agent allowance exhausted for this month.', 429, 'AGENT_ALLOWANCE_EXHAUSTED')
    }
    await prisma.siteAgentIntent.update({ where: { id: admitted.intent.id }, data: { reservationId: reservation.reservationId } })
    let reservationId: string | null = reservation.reservationId
    try {
      const result = await runWorkspaceChat(context)
      reply = result.reply
      usage = result.usage
      reservationId = null
    } catch (error) {
      if (reservationId && error instanceof WorkspaceChatUnavailableError && error.usage) {
        await finalizeChatUsage(reservationId, error.usage)
        reservationId = null
      }
      throw error
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
    citations.push({ type: 'watch', id: project.id, label: 'Watch status', href: `/sites/${project.id}/settings#watch` })
  }

  const ready = await saveAgentReply(admitted.intent.id, { reply, citations, usage })
  const response = await completeAgentMessage(ready, input.userId)
  await recordSiteLifecycleEvent({
    name: 'agent_answered',
    idempotencyKey: `agent-answered:${response.messageId}`,
    userId: input.userId,
    projectId: project.id,
    properties: { deterministic: Boolean(deterministic), citationCount: citations.length },
  }).catch(() => undefined)

  return response
  } catch (error) {
    // READY responses remain recoverable if only accounting or message persistence failed.
    await prisma.siteAgentIntent.updateMany({ where: { id: admitted.intent.id, status: 'PENDING' },
      data: { status: 'FAILED', errorCode: error instanceof SiteAgentError ? error.code ?? 'AGENT_UNAVAILABLE' : 'AGENT_UNAVAILABLE', completedAt: new Date() } })
    throw error
  }
}
