import { SiteNotFound } from '@/lib/sites/domain/site-errors'
import { authorizeAgentCitations } from './agent-citations'
import { SiteAgentError, type AgentCitation } from '@/lib/sites/agent-contract'
import { admitAgentMessage, completeAgentMessage, replayAgentMessage, saveAgentReply, recoverAgentReplies, recordAgentReservation, failAgentMessage } from './agent-intents'
import { siteWideAnalysisAuditWhere } from './analysis-scope'
import { loadSiteRecord } from '@/lib/sites/ensure-site'
import { loadSiteFlagDetail } from '@/lib/sites/flags'
import { prisma } from '@/lib/db'
import { getFlagDiffSummary } from '@/lib/audit/diff-flags'
import { loadProjectIntelligence } from '@/lib/audit/ensure-product-project'
import { loadSiteAgentContext } from './agent-context'
import {
  answerProductQuestion,
  runWorkspaceChat,
  WorkspaceChatUnavailableError,
  workspaceChatTokenUpperBound,
  type ChatDiffSummary,
} from '@/lib/workspace/chat'
import { finalizeChatUsage, releaseChatUsage, reserveChatUsage } from '@/lib/billing/chat-usage'
import { recordSiteLifecycleEvent } from '@/lib/analytics/site-events'
import { SITE_AGENT_COPY } from '@/lib/marketing/copy/site-agent'
import { readSiteEvidence } from './site-evidence-read'
import { SiteRunRefusal } from './run-refusal'

const MAX_MESSAGES = 40
const MAX_MODEL_FLAGS = 12

function rethrowAgentError(error: unknown): never {
  if (error instanceof SiteRunRefusal) throw new SiteAgentError('Site not found', 404)
  throw error
}

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
    where: { id: siteId, userId, deletedAt: null, user: { lifecycleStatus: 'ACTIVE' } },
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
    },
  })
  if (!project) throw new SiteNotFound()
  return project
}

export async function getSiteAgentHistory(input: { siteId: string; userId: string }) {
  await requireOwnedSite(input.siteId, input.userId)
  return readSiteEvidence({ kind: 'project', projectId: input.siteId, userId: input.userId }, async () => {
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
  }).catch(rethrowAgentError)
}

export async function sendSiteAgentMessage(input: { siteId: string; userId: string; message: string; requestKey: string; flagId?: string }) {
  const project = await requireOwnedSite(input.siteId, input.userId)
  await recoverAgentReplies(project.id, input.userId)
  const selectedFlag = input.flagId ? await loadSiteRecord(input.siteId).then(site =>
    site?.userId === input.userId ? loadSiteFlagDetail(site, input.flagId!) : null).catch(rethrowAgentError) : null
  if (input.flagId && !selectedFlag) throw new SiteAgentError('Flag not found', 404)
  const admitted = await admitAgentMessage({ ...input, projectId: project.id, storedMessage: minimizeStoredMessage(input.message) })
  if (!admitted.created) return replayAgentMessage(admitted.intent, input.userId)
  let spentUsage: { reservationId: string; usage: { inputTokens: number; outputTokens: number; model?: string } } | null = null
  try {
  // Greeting-only messages use authorized context and the same durable receipt path.
  if (/^(?:hi|hello|hey)[\s!.,?]*$/i.test(input.message.trim())) {
    const reply = SITE_AGENT_COPY.greeting(project.canonicalHost, selectedFlag?.problem)
    const ready = await saveAgentReply(admitted.intent.id, { reply, citations: [], usage: null }, input.userId)
    const response = await completeAgentMessage(ready, input.userId)
    await recordSiteLifecycleEvent({ name: 'agent_answered', idempotencyKey: `agent-answered:${response.messageId}`,
      userId: input.userId, projectId: project.id, properties: { deterministic: true, citationCount: 0 } }).catch(() => undefined)
    return response
  }
  const priorMessages = await prisma.siteAgentMessage.findMany({ where: { threadId: admitted.intent.threadId, intentId: { not: admitted.intent.id } },
    orderBy: { createdAt: 'desc' }, take: 6, select: { role: true, content: true } })
  const latest = project.audits[0] ?? null
  const contextSite = await loadSiteRecord(project.id)
  if (contextSite?.userId !== input.userId) throw new SiteAgentError('Site not found', 404)
  const { flags, improvements, findingScope, uptime } = await loadSiteAgentContext(contextSite, selectedFlag).catch(rethrowAgentError)
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
    uptime,
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
      flags: flags.slice(0, MAX_MODEL_FLAGS),
      improvements: improvements.slice(0, MAX_MODEL_FLAGS),
      findingScope,
      uptime,
      conversation: priorMessages.toReversed().map(message => ({ role: message.role === 'USER' ? 'user' as const : 'assistant' as const, content: message.content })),
    }
    const reservation = await reserveChatUsage(project.user, workspaceChatTokenUpperBound(context))
    if (!reservation.reservationId) {
      throw new SiteAgentError('Agent allowance exhausted for this month.', 429, 'AGENT_ALLOWANCE_EXHAUSTED')
    }
    let reservationId: string | null = reservation.reservationId
    try {
      await recordAgentReservation(admitted.intent.id, input.userId, reservation.reservationId)
      const result = await runWorkspaceChat(context)
      reply = result.reply
      usage = result.usage
      spentUsage = { reservationId: reservation.reservationId, usage: result.usage }
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

  const citedFlags = deterministic ? deterministic.flagIds.flatMap(id => {
    const flag = flags.find(flag => flag.id === id || flag.sourceFlagId === id)
    return flag ? [{ ...flag, id }] : []
  }) : flags
  const citations: AgentCitation[] = citedFlags.slice(0, 3).map((flag) => ({
    type: 'flag',
    id: flag.id,
    label: flag.problem,
    href: `/sites/${project.id}/flags/${flag.id}`,
  }))
  if (deterministic?.uptime || !deterministic && uptime !== undefined) {
    const citation: AgentCitation = { type: 'watch', id: project.id, label: 'Uptime evidence',
      href: `/sites/${project.id}?category=uptime#category-uptime` }
    if (uptime?.assessment?.state === 'FLAG') citations.unshift(citation)
    else citations.push(citation)
  } else if (project.watchLastRunAt || project.watchLastError) {
    citations.push({ type: 'watch', id: project.id, label: 'Watch status', href: `/sites/${project.id}/settings#watch` })
  }

  const ready = await saveAgentReply(admitted.intent.id, { reply, citations, usage }, input.userId)
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
    // Account for an admitted provider result even when changed permission
    // prevents publishing it. Saved responses retain their recovery receipt.
    try {
      if (spentUsage) await finalizeChatUsage(spentUsage.reservationId, spentUsage.usage)
    } finally {
      await failAgentMessage(admitted.intent.id, input.userId,
        error instanceof SiteAgentError ? error.code ?? 'AGENT_UNAVAILABLE' : 'AGENT_UNAVAILABLE')
    }
    throw error
  }
}
