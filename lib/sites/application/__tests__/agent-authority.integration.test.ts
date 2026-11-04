import { randomUUID } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { prisma } from '@/lib/db'
import { admitAgentMessage, completeAgentMessage, recoverAgentReplies, replayAgentMessage, saveAgentReply } from '../agent-intents'
import { getSiteAgentHistory, sendSiteAgentMessage } from '../agent'
import * as usage from '@/lib/billing/chat-usage'

const model = vi.hoisted(() => vi.fn())
vi.mock('@/lib/workspace/chat', async original => ({ ...await original<typeof import('@/lib/workspace/chat')>(),
  answerProductQuestion: () => null, runWorkspaceChat: model }))

const run = process.env.PROGRESSIVE_EXECUTION_DB_REQUIRED === 'true' ? describe : describe.skip
run('Site agent retained owner', () => {
  let userId: string, replacementId: string, projectId: string
  const response = { reply: 'The captured page title is missing.', citations: [], usage: null }
  beforeEach(async () => {
    const database = new URL(process.env.DATABASE_URL!)
    if (!['localhost', '127.0.0.1'].includes(database.hostname) || !/^\/fixflags_execution_test_[a-f0-9]{32}$/.test(database.pathname))
      throw new Error('Use the disposable execution verifier')
    const key = randomUUID()
    userId = (await prisma.user.create({ data: { email: key + '@agent-owner.example' } })).id
    replacementId = (await prisma.user.create({ data: { email: key + '@agent-next.example' } })).id
    projectId = (await prisma.project.create({ data: { userId, canonicalHost: 'example.com', url: 'https://example.com/', name: 'Private conversation' } })).id
    model.mockReset()
  })
  afterEach(async () => {
    vi.restoreAllMocks()
    await prisma.user.deleteMany({ where: { id: { in: [userId, replacementId] } } })
  })
  const input = () => ({ projectId, userId, requestKey: 'question:1', message: 'Explain the title problem', storedMessage: 'Explain the title problem' })
  async function change(kind: 'transfer' | 'remove' | 'suspend') {
    if (kind === 'transfer') await prisma.project.update({ where: { id: projectId }, data: { userId: replacementId } })
    else if (kind === 'remove') await prisma.project.update({ where: { id: projectId }, data: { deletedAt: new Date() } })
    else await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'SUSPENDED' } })
  }
  async function restore() {
    await prisma.user.update({ where: { id: userId }, data: { lifecycleStatus: 'ACTIVE' } })
    await prisma.project.update({ where: { id: projectId }, data: { userId, deletedAt: null } })
  }

  it.each(['transfer', 'remove', 'suspend'] as const)('refuses admission after %s without creating conversation records', async kind => {
    await change(kind)
    await expect(admitAgentMessage(input())).rejects.toMatchObject({ status: 404 })
    expect(await prisma.siteAgentThread.count({ where: { projectId } })).toBe(0)
    expect(await prisma.siteAgentIntent.count({ where: { thread: { projectId } } })).toBe(0)
  })

  it.each(['transfer', 'remove', 'suspend'] as const)('retains saved replies across %s and recovers only for the original authorized owner', async kind => {
    const { intent } = await admitAgentMessage(input())
    await change(kind)
    await expect(saveAgentReply(intent.id, response, userId)).rejects.toMatchObject({ status: 404 })
    expect(await prisma.siteAgentIntent.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({ status: 'PENDING', response: null })
    await restore()
    const ready = await saveAgentReply(intent.id, response, userId)
    await change(kind)
    await expect(completeAgentMessage(ready, userId)).rejects.toMatchObject({ status: 404 })
    await expect(replayAgentMessage(ready, userId)).rejects.toMatchObject({ status: 404 })
    await expect(recoverAgentReplies(projectId, userId)).rejects.toMatchObject({ status: 404 })
    await expect(completeAgentMessage(ready, replacementId)).rejects.toMatchObject({ status: 404 })
    expect(await prisma.siteAgentIntent.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({ status: 'READY', response })
    expect(await prisma.siteAgentMessage.count({ where: { threadId: intent.threadId, role: 'ASSISTANT' } })).toBe(0)
    await restore()
    await recoverAgentReplies(projectId, userId)
    const completed = await prisma.siteAgentIntent.findUniqueOrThrow({ where: { id: intent.id } })
    const replayed = await replayAgentMessage(ready, userId)
    expect(await replayAgentMessage({ ...ready, response: { ...response, reply: 'Untrusted stale payload' } }, userId)).toEqual(replayed)
    expect(await prisma.siteAgentIntent.findUniqueOrThrow({ where: { id: intent.id } })).toEqual(completed)
    expect(await prisma.siteAgentMessage.count({ where: { threadId: intent.threadId, role: 'ASSISTANT' } })).toBe(1)
  })

  it('rechecks the owner after accounting and before committing an assistant message', async () => {
    const { intent } = await admitAgentMessage(input())
    const ready = await saveAgentReply(intent.id, response, userId)
    const original = prisma.$transaction.bind(prisma)
    vi.spyOn(prisma, '$transaction').mockImplementationOnce((async (...args: Parameters<typeof original>) => {
      const result = await original(...args)
      await change('transfer')
      return result
    }) as typeof original)
    await expect(completeAgentMessage(ready, userId)).rejects.toMatchObject({ status: 404 })
    expect(await prisma.siteAgentMessage.count({ where: { threadId: intent.threadId, role: 'ASSISTANT' } })).toBe(0)
    expect(await prisma.siteAgentIntent.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({ status: 'READY' })
  })

  it('keeps concurrent admissions idempotent and never revives a superseded pending reply', async () => {
    const admissions = await Promise.all([admitAgentMessage(input()), admitAgentMessage(input())])
    expect(admissions.map(row => row.created).sort()).toEqual([false, true])
    const intent = admissions[0].intent
    expect(admissions[1].intent.id).toBe(intent.id)
    await expect(admitAgentMessage({ ...input(), message: 'A different question' })).rejects.toMatchObject({ status: 409, code: 'AGENT_INTENT_MISMATCH' })
    await prisma.siteAgentIntent.update({ where: { id: intent.id }, data: { createdAt: new Date(Date.now() - 180_000) } })
    const next = await admitAgentMessage({ ...input(), requestKey: 'question:2' })
    expect(next.created).toBe(true)
    await expect(saveAgentReply(intent.id, response, userId)).rejects.toMatchObject({ code: 'AGENT_INTERRUPTED' })
    expect(await prisma.siteAgentIntent.findUniqueOrThrow({ where: { id: intent.id } })).toMatchObject({ status: 'FAILED', response: null })
    expect(await prisma.siteAgentMessage.count({ where: { threadId: intent.threadId, role: 'USER' } })).toBe(2)
  })

  it('waits for an in-flight Site transfer and compares the owner before admission writes', async () => {
    let locked!: () => void, release!: () => void
    const acquired = new Promise<void>(resolve => { locked = resolve })
    const released = new Promise<void>(resolve => { release = resolve })
    const transfer = prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM projects WHERE id = ${projectId} FOR UPDATE`
      locked()
      await released
      await tx.project.update({ where: { id: projectId }, data: { userId: replacementId } })
    })
    await acquired
    const admission = admitAgentMessage(input()).then(value => ({ value, error: null }), error => ({ value: null, error }))
    let waited = false
    try {
      for (let tries = 0; tries < 100; tries++) {
        const [state] = await prisma.$queryRaw<Array<{ waiting: boolean }>>`SELECT EXISTS (
          SELECT 1 FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()
            AND wait_event_type = 'Lock' AND query LIKE 'SELECT id FROM projects%') AS waiting`
        if (state.waiting) { waited = true; break }
        await new Promise(resolve => setTimeout(resolve, 20))
      }
    } finally { release(); await transfer }
    expect((await admission).error).toMatchObject({ status: 404 })
    expect(waited).toBe(true)
    expect(await prisma.siteAgentThread.count({ where: { projectId } })).toBe(0)
  })

  it('persists a normal local provider response once and replays its original usage and message receipt', async () => {
    model.mockResolvedValue({ reply: response.reply, usage: { inputTokens: 7, outputTokens: 11 } })
    const message = { siteId: projectId, userId, requestKey: 'provider:1', message: input().message }
    const first = await sendSiteAgentMessage(message)
    expect(await sendSiteAgentMessage(message)).toEqual(first)
    expect(model).toHaveBeenCalledTimes(1)
    expect(await prisma.siteAgentMessage.count({ where: { thread: { projectId } } })).toBe(2)
    expect(await prisma.chatUsageReservation.findMany({ where: { period: { userId } } }))
      .toMatchObject([{ status: 'FINALIZED', inputTokens: 7, outputTokens: 11 }])
  })

  it('releases reserved allowance and refuses provider dispatch after ownership changes during reservation', async () => {
    const original = usage.reserveChatUsage
    vi.spyOn(usage, 'reserveChatUsage').mockImplementationOnce(async (...args) => {
      const reservation = await original(...args)
      await change('transfer')
      return reservation
    })
    await expect(sendSiteAgentMessage({ siteId: projectId, userId, requestKey: 'provider:1', message: input().message }))
      .rejects.toMatchObject({ status: 404 })
    expect(model).not.toHaveBeenCalled()
    const reservations = await prisma.chatUsageReservation.findMany({ where: { period: { userId } } })
    expect(reservations).toMatchObject([{ status: 'FINALIZED', inputTokens: 0, outputTokens: 0 }])
    expect(await prisma.siteAgentIntent.findMany({ where: { thread: { projectId, userId } } })).toMatchObject([{ status: 'PENDING', response: null }])
  })

  it.each(['transfer', 'remove', 'suspend'] as const)('accounts for admitted provider work but withholds its result after %s', async kind => {
    model.mockImplementationOnce(async () => {
      await change(kind)
      return { reply: response.reply, usage: { inputTokens: 7, outputTokens: 11 } }
    })
    await expect(sendSiteAgentMessage({ siteId: projectId, userId, requestKey: 'provider:1', message: input().message }))
      .rejects.toMatchObject({ status: 404 })
    expect(model).toHaveBeenCalledTimes(1)
    expect(await prisma.chatUsageReservation.findMany({ where: { period: { userId } } }))
      .toMatchObject([{ status: 'FINALIZED', inputTokens: 7, outputTokens: 11 }])
    expect(await prisma.siteAgentMessage.count({ where: { thread: { projectId }, role: 'ASSISTANT' } })).toBe(0)
    expect(await prisma.siteAgentIntent.findMany({ where: { thread: { projectId, userId } } })).toMatchObject([{ status: 'PENDING', response: null }])
  })

  it('withholds history if ownership changes while messages are collected', async () => {
    const { intent } = await admitAgentMessage(input())
    const ready = await saveAgentReply(intent.id, response, userId)
    await completeAgentMessage(ready, userId)
    const original = prisma.siteAgentThread.findFirst.bind(prisma.siteAgentThread)
    const hook = vi.spyOn(prisma.siteAgentThread, 'findFirst').mockImplementationOnce((async args => {
      const thread = await original(args)
      await change('transfer')
      return thread
    }) as typeof original)
    await expect(getSiteAgentHistory({ siteId: projectId, userId })).rejects.toMatchObject({ status: 404 })
    hook.mockRestore()
    expect(await getSiteAgentHistory({ siteId: projectId, userId: replacementId })).toMatchObject({ messages: [] })
    await restore()
    expect(await getSiteAgentHistory({ siteId: projectId, userId })).toMatchObject({ messages: [
      { role: 'user', content: input().storedMessage }, { role: 'assistant', content: response.reply },
    ] })
  })
})
