import { createHash } from 'node:crypto'
import { Prisma, type SiteAgentIntent } from '@prisma/client'
import { z } from 'zod'
import { prisma } from '@/lib/db'
import { finalizeChatUsage } from '@/lib/billing/chat-usage'
import { agentCitationSchema, SiteAgentError } from '@/lib/sites/agent-contract'

const readySchema = z.object({ reply: z.string().min(1), citations: z.array(agentCitationSchema),
  usage: z.object({ inputTokens: z.number().int().nonnegative(), outputTokens: z.number().int().nonnegative(), model: z.string().optional() }).nullable(),
})

/** Serial admission is committed before any model request or usage reservation. */
export async function admitAgentMessage(input: {
  projectId: string; userId: string; requestKey: string; message: string; storedMessage: string; flagId?: string
}) {
  const hash = createHash('sha256').update(JSON.stringify([input.message, input.flagId ?? null])).digest('hex')
  return prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`site-agent:${input.projectId}:${input.userId}`}, 0))`
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
  const saved = readySchema.parse(intent.response)
  if (intent.reservationId && saved.usage) await finalizeChatUsage(intent.reservationId, saved.usage)
  return prisma.$transaction(async tx => {
    const assistant = await tx.siteAgentMessage.upsert({
      where: { intentId_role: { intentId: intent.id, role: 'ASSISTANT' } }, update: {},
      create: { threadId: intent.threadId, userId, role: 'ASSISTANT', content: saved.reply,
        citations: saved.citations, intentId: intent.id },
    })
    await tx.siteAgentIntent.update({ where: { id: intent.id }, data: { status: 'COMPLETED', completedAt: new Date() } })
    await tx.siteAgentThread.update({ where: { id: intent.threadId }, data: { updatedAt: new Date() } })
    return { reply: saved.reply, citations: saved.citations, messageId: assistant.id, createdAt: assistant.createdAt.toISOString(), threadId: intent.threadId }
  })
}

export async function replayAgentMessage(intent: SiteAgentIntent, userId: string) {
  if (intent.status === 'READY' || intent.status === 'COMPLETED') return completeAgentMessage(intent, userId)
  if (intent.status === 'PENDING' && intent.createdAt.getTime() > Date.now() - 120_000)
    throw new SiteAgentError('Your reply is still being prepared. Check again in a moment.', 409, 'AGENT_PENDING')
  throw new SiteAgentError('This reply was interrupted. Your message is saved. Start a new message to try again.', 503, intent.errorCode ?? 'AGENT_INTERRUPTED')
}

export async function saveAgentReply(intentId: string, response: z.infer<typeof readySchema>) {
  const saved = readySchema.parse(response)
  return prisma.siteAgentIntent.update({ where: { id: intentId }, data: { status: 'READY', response: saved as Prisma.InputJsonObject } })
}

/** Recover a response already saved before an interrupted accounting or message commit. */
export async function recoverAgentReplies(projectId: string, userId: string) {
  const ready = await prisma.siteAgentIntent.findMany({ where: { status: 'READY', thread: { projectId, userId } }, orderBy: { createdAt: 'asc' } })
  for (const intent of ready) await completeAgentMessage(intent, userId)
}
