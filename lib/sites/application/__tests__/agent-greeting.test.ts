import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  project: vi.fn(), prior: vi.fn(), update: vi.fn(), updateMany: vi.fn(), admit: vi.fn(),
  save: vi.fn(), complete: vi.fn(), replay: vi.fn(), recover: vi.fn(), site: vi.fn(), flag: vi.fn(),
  reserve: vi.fn(), release: vi.fn(), model: vi.fn(), deterministic: vi.fn(), intelligence: vi.fn(),
}))
vi.mock('@/lib/db', () => ({ prisma: {
  project: { findFirst: mocks.project }, siteAgentMessage: { findMany: mocks.prior },
  siteAgentIntent: { update: mocks.update, updateMany: mocks.updateMany },
} }))
vi.mock('../agent-intents', () => ({ admitAgentMessage: mocks.admit, saveAgentReply: mocks.save,
  completeAgentMessage: mocks.complete, replayAgentMessage: mocks.replay, recoverAgentReplies: mocks.recover }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.site }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.flag }))
vi.mock('@/lib/billing/chat-usage', () => ({ reserveChatUsage: mocks.reserve, releaseChatUsage: mocks.release, finalizeChatUsage: vi.fn() }))
vi.mock('@/lib/workspace/chat', () => ({ answerProductQuestion: mocks.deterministic, runWorkspaceChat: mocks.model,
  workspaceChatTokenUpperBound: () => 100, WorkspaceChatUnavailableError: class extends Error {} }))
vi.mock('@/lib/audit/ensure-product-project', () => ({ loadProjectIntelligence: mocks.intelligence }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn(async () => undefined) }))

import { sendSiteAgentMessage } from '../agent'
import { SITE_AGENT_COPY } from '@/lib/marketing/copy/site-agent'

const input = { siteId: 'site-1', userId: 'owner-1', requestKey: 'web:greeting', message: 'hi' }
const receipt = { reply: 'Saved answer', citations: [], threadId: 'thread-1', messageId: 'message-1', createdAt: '2026-10-12T09:00:00Z' }
beforeEach(() => {
  vi.resetAllMocks()
  mocks.project.mockResolvedValue({ id: 'site-1', canonicalHost: 'example.com', url: 'https://example.com',
    user: { id: 'owner-1' }, audits: [], improvements: [] })
  mocks.recover.mockResolvedValue(undefined)
  mocks.admit.mockResolvedValue({ created: true, intent: { id: 'intent-1', threadId: 'thread-1' } })
  mocks.save.mockResolvedValue({ id: 'intent-1', response: {} })
  mocks.complete.mockResolvedValue(receipt)
  mocks.replay.mockResolvedValue(receipt)
  mocks.site.mockResolvedValue({ id: 'site-1' })
  mocks.flag.mockResolvedValue({ id: 'flag-1', problem: 'Cart remained empty' })
  mocks.prior.mockResolvedValue([])
  mocks.intelligence.mockResolvedValue(null)
  mocks.deterministic.mockReturnValue(null)
  mocks.reserve.mockResolvedValue({ reservationId: 'reservation-1' })
  mocks.model.mockResolvedValue({ reply: 'An evidence answer', usage: { inputTokens: 20, outputTokens: 30 } })
})

describe('Site greetings', () => {
  it.each(['hi', 'Hello!', '  HEY...  '])('persists contextual greeting %s without using model allowance', async message => {
    expect(await sendSiteAgentMessage({ ...input, message })).toEqual(receipt)
    expect(mocks.save).toHaveBeenCalledWith('intent-1', { reply: SITE_AGENT_COPY.greeting('example.com'), citations: [], usage: null })
    expect(mocks.complete).toHaveBeenCalled()
    expect(mocks.reserve).not.toHaveBeenCalled()
    expect(mocks.model).not.toHaveBeenCalled()
  })

  it('uses only an authorized Flag title', async () => {
    await sendSiteAgentMessage({ ...input, flagId: 'flag-1' })
    expect(mocks.flag).toHaveBeenCalledWith({ id: 'site-1' }, 'flag-1')
    expect(mocks.save).toHaveBeenCalledWith('intent-1', { reply: SITE_AGENT_COPY.greeting('example.com', 'Cart remained empty'), citations: [], usage: null })
  })

  it('rejects another owner before greeting or admission', async () => {
    mocks.project.mockResolvedValue(null)
    await expect(sendSiteAgentMessage(input)).rejects.toMatchObject({ status: 404 })
    expect(mocks.admit).not.toHaveBeenCalled()
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('rejects an unavailable Flag before admission', async () => {
    mocks.flag.mockResolvedValue(null)
    await expect(sendSiteAgentMessage({ ...input, flagId: 'other-flag' })).rejects.toMatchObject({ status: 404 })
    expect(mocks.admit).not.toHaveBeenCalled()
  })

  it('replays the original request receipt instead of storing another greeting', async () => {
    mocks.admit.mockResolvedValue({ created: false, intent: { id: 'intent-1' } })
    expect(await sendSiteAgentMessage(input)).toEqual(receipt)
    expect(mocks.replay).toHaveBeenCalledWith({ id: 'intent-1' }, input.userId)
    expect(mocks.save).not.toHaveBeenCalled()
  })

  it('keeps a saved greeting recoverable if the message commit is interrupted', async () => {
    mocks.complete.mockRejectedValueOnce(new Error('commit interrupted'))
    await expect(sendSiteAgentMessage(input)).rejects.toThrow('commit interrupted')
    expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'intent-1', status: 'PENDING' } }))
    mocks.admit.mockResolvedValue({ created: false, intent: { id: 'intent-1' } })
    expect(await sendSiteAgentMessage(input)).toEqual(receipt)
    expect(mocks.save).toHaveBeenCalledTimes(1)
  })

  it('routes greetings with substantive questions through normal evidence answering', async () => {
    await sendSiteAgentMessage({ ...input, message: 'Hi, why is checkout failing?' })
    expect(mocks.model).toHaveBeenCalledWith(expect.objectContaining({ message: 'Hi, why is checkout failing?' }))
    expect(mocks.reserve).toHaveBeenCalled()
    expect(mocks.save).toHaveBeenCalledWith('intent-1', expect.objectContaining({ reply: 'An evidence answer' }))
  })
})
