import { createHash } from 'node:crypto'
import { Prisma, type SiteAgentIntent } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { finalizeChatUsage } from '@/lib/billing/chat-usage'
import { agentCitationSchema, SiteAgentError } from '@/lib/sites/agent-contract'

const readySchema = z.object({ reply: z.string().min(1), citations: z.array(agentCitationSchema),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), model: z.string().optional() }).nullable(),
})

/** Parent-first locks retain the active owner only for the short database
 * mutation. Provider work and accounting never hold these locks. */
async function lockAgentOwner(tx: Prisma.TransactionClient, projectId: string, userId: string) {
  const owners = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM users
    WHERE id = ${userId} AND "lifecycleStatus" = 'ACTIVE' FOR SHARE`
  if (owners.length !== 1) throw new SiteAgentError('Site not found', 404)
  const sites = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM projects
    WHERE id = ${projectId} AND "userId" = ${userId} AND "deletedAt" IS NULL FOR UPDATE`
  if (sites.length !== 1) throw new SiteAgentError('Site not found', 404)
}

async function withAgentIntent<T>(intentId: string, userId: string,
  work: (tx: Prisma.TransactionClient, intent: SiteAgentIntent) => Promise<T>) {
  return prisma.$transaction(async tx => {
    const identity = await tx.siteAgentIntent.findFirst({ where: { id: intentId, thread: { userId } },
      select: { thread: { select: { projectId: true } } } })
    if (!identity) throw new SiteAgentError('Site not found', 404)
    await lockAgentOwner(tx, identity.thread.projectId, userId)
    const current = await tx.siteAgentIntent.findFirst({ where: { id: intentId,
      thread: { projectId: identity.thread.projectId, userId } } })
    if (!current) throw new SiteAgentError('Site not found', 404)
    return work(tx, current)
  })
}

function requireSavedReply(intent: SiteAgentIntent) {
  if (!['READY', 'COMPLETED'].includes(intent.status))
    throw new SiteAgentError('This reply was interrupted. Your message is saved. Start a new message to try again.', 503, intent.errorCode ?? 'AGENT_INTERRUPTED')
  return readySchema.parse(intent.response)
}

/** Serial admission is committed before any model request or usage reservation. */
export async function admitAgentMessage(input: {
  projectId: string; userId: string; requestKey: string; message: string; storedMessage: string; flagId?: string
}) {
  const hash = createHash('sha256').update(JSON.stringify([input.message, input.flagId ?? null])).digest('hex')
  return prisma.$transaction(async tx => {
    await lockAgentOwner(tx, input.projectId, input.userId)
    const existing = await tx.siteAgentThread.findFirst({ where: { projectId: input.projectId, userId: input.userId }, orderBy: { updatedAt: 'desc' } })
    const thread = existing ?? await tx.siteAgentThread.create({ data: { projectId: input.projectId, userId: input.userId } })
    const receipt = await tx.siteAgentIntent.findUnique({ where: { threadId_requestKey: { threadId: thread.id, requestKey: input.requestKey } } })
    if (receipt) {
      if (receipt.requestHash !== hash) throw new SiteAgentError('This request key belongs to a different message.', 409, 'AGENT_INTENT_MISMATCH')
      return { intent: receipt, created: false }
    }
    const active = await tx.siteAgentIntent.findFirst({ where: { threadId: thread.id, status: { in: ['PENDING', 'READY'] } } })
    if (active && active.createdAt.getTime() > Date.now() - 120_000)
      throw new SiteAgentError('A reply is still being prepared. Check the conversation before sending again.', 409, 'AGENT_PENDING')
    if (active?.status === 'READY') throw new SiteAgentError('A saved reply needs to be recovered first.', 409, 'AGENT_RECEIPT_PENDING')
    if (active) await tx.siteAgentIntent.update({ where: { id: active.id }, data: { status: 'FAILED', errorCode: 'AGENT_INTERRUPTED', completedAt: new Date() } })
    const intent = await tx.siteAgentIntent.create({ data: { threadId: thread.id, requestKey: input.requestKey, requestHash: hash, flagId: input.flagId } })
    await tx.siteAgentMessage.create({ data: { threadId: thread.id, userId: input.userId, role: 'USER',
      content: input.storedMessage, intentId: intent.id } })
    return { intent, created: true }
  })
}

export async function completeAgentMessage(intent: SiteAgentIntent, userId: string) {
  const recorded = await withAgentIntent(intent.id, userId, async (_tx, current) => {
    requireSavedReply(current)
    return current
  })
  const usage = requireSavedReply(recorded).usage
  if (recorded.reservationId && usage) await finalizeChatUsage(recorded.reservationId, usage)
  return withAgentIntent(intent.id, userId, async (tx, current) => {
    const saved = requireSavedReply(current)
    const assistant = await tx.siteAgentMessage.upsert({
      where: { intentId_role: { intentId: current.id, role: 'ASSISTANT' } }, update: {},
      create: { threadId: current.threadId, userId, role: 'ASSISTANT', content: saved.reply,
        citations: saved.citations, intentId: current.id },
    })
    if (current.status !== 'COMPLETED') {
      await tx.siteAgentIntent.update({ where: { id: current.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
      await tx.siteAgentThread.update({ where: { id: current.threadId }, data: { updatedAt: new Date() } })
    }
    return { reply: saved.reply, citations: saved.citations, messageId: assistant.id, createdAt: assistant.createdAt.toISOString(), threadId: current.threadId }
  })
}

export async function replayAgentMessage(intent: SiteAgentIntent, userId: string) {
  const current = await withAgentIntent(intent.id, userId, async (_tx, current) => current)
  if (current.status === 'READY' || current.status === 'COMPLETED') return completeAgentMessage(current, userId)
  if (current.status === 'PENDING' && current.createdAt.getTime() > Date.now() - 120_000)
    throw new SiteAgentError('Your reply is still being prepared. Check again in a moment.', 409, 'AGENT_PENDING')
  throw new SiteAgentError('This reply was interrupted. Your message is saved. Start a new message to try again.', 503, current.errorCode ?? 'AGENT_INTERRUPTED')
}

/** Bind the already reserved allowance only while this exact message can still
 * start provider work. A refused binding leaves the caller to release it. */
export async function recordAgentReservation(intentId: string, userId: string, reservationId: string) {
  return withAgentIntent(intentId, userId, async (tx, current) => {
    if (current.status !== 'PENDING') throw new SiteAgentError('This reply was interrupted.', 503, 'AGENT_INTERRUPTED')
    const reservation = await tx.chatUsageReservation.findFirst({ where: { id: reservationId, status: 'RESERVED',
      expiresAt: { gt: new Date() }, period: { userId } }, select: { id: true } })
    if (!reservation) throw new SiteAgentError('Agent allowance is unavailable.', 503, 'AGENT_UNAVAILABLE')
    await tx.siteAgentIntent.update({ where: { id: current.id }, data: { reservationId } })
  })
}

export async function saveAgentReply(intentId: string, response: z.infer<typeof readySchema>, userId: string) {
  const saved = readySchema.parse(response)
  return withAgentIntent(intentId, userId, async (tx, current) => {
    if (current.status !== 'PENDING') throw new SiteAgentError('This reply was interrupted.', 503, 'AGENT_INTERRUPTED')
    return tx.siteAgentIntent.update({ where: { id: current.id }, data: { status: 'READY', response: saved as Prisma.InputJsonObject } })
  })
}

export async function failAgentMessage(intentId: string, userId: string, errorCode: string) {
  try {
    await withAgentIntent(intentId, userId, async (tx, current) => {
      await tx.siteAgentIntent.updateMany({ where: { id: current.id, status: 'PENDING' },
        data: { status: 'FAILED', errorCode, completedAt: new Date() } })
    })
  } catch (error) {
    if (!(error instanceof SiteAgentError && error.status === 404)) throw error
  }
}

/** Recover a response already saved before an interrupted accounting or message commit. */
export async function recoverAgentReplies(projectId: string, userId: string) {
  const ready = await prisma.$transaction(async tx => {
    await lockAgentOwner(tx, projectId, userId)
    return tx.siteAgentIntent.findMany({ where: { status: 'READY', thread: { projectId, userId } }, orderBy: { createdAt: 'asc' } })
  })
  for (const intent of ready) await completeAgentMessage(intent, userId)
}
