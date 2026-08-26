import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
  user: { findUnique: vi.fn() },
  reportChatMessage: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
  },
  flag: { findMany: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())
const requestClientId = vi.hoisted(() => vi.fn(() => 'test-client'))
const isWorkspaceChatConfigured = vi.hoisted(() => vi.fn())
const runWorkspaceChat = vi.hoisted(() => vi.fn())
const answerProductQuestion = vi.hoisted(() => vi.fn())
const workspaceChatTokenUpperBound = vi.hoisted(() => vi.fn(() => 10_000))
const WorkspaceChatUnavailableError = vi.hoisted(() => class WorkspaceChatUnavailableError extends Error {})
const getChatAllowance = vi.hoisted(() => vi.fn())
const reserveChatUsage = vi.hoisted(() => vi.fn())
const finalizeChatUsage = vi.hoisted(() => vi.fn())
const releaseChatUsage = vi.hoisted(() => vi.fn())
const RateLimitError = vi.hoisted(() => class RateLimitError extends Error {
  retryAfter: number
  constructor(retryAfter: number) {
    super('Too many requests')
    this.retryAfter = retryAfter
  }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit,
  requestClientId,
  RateLimitError,
}))
vi.mock('@/lib/workspace/chat', () => ({
  answerProductQuestion,
  isWorkspaceChatConfigured,
  runWorkspaceChat,
  workspaceChatTokenUpperBound,
  WorkspaceChatUnavailableError,
}))
vi.mock('@/lib/billing/chat-usage', () => ({
  getChatAllowance,
  reserveChatUsage,
  finalizeChatUsage,
  releaseChatUsage,
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: vi.fn() }),
}))

import { GET, POST } from '@/app/api/reports/[id]/chat/route'

function getReq() {
  return {
    headers: new Headers(),
    url: 'http://localhost/api/reports/report-1/chat',
    nextUrl: { searchParams: new URLSearchParams() },
    json: async () => ({ message: 'What should I fix first?' }),
  } as unknown as NextRequest
}

const ownedAudit = {
  id: 'report-1',
  userId: 'user-1',
  url: 'https://example.com/',
  status: 'COMPLETED',
}

const historyMessage = { role: 'user', content: 'hi', createdAt: new Date() }

describe('/api/reports/[id]/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'user-1' } })
    enforceRateLimit.mockResolvedValue({ exceeded: false })
    prismaMock.audit.findUnique.mockResolvedValue(ownedAudit)
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'user-1', plan: 'FREE', role: 'user', subscriptionStatus: 'NONE',
    })
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.reportChatMessage.count.mockResolvedValue(0)
    prismaMock.reportChatMessage.findMany.mockResolvedValue([historyMessage])
    prismaMock.reportChatMessage.createMany.mockResolvedValue({ count: 2 })
    getChatAllowance.mockResolvedValue({ limit: 25_000, used: 0, reserved: 0, remaining: 25_000, resetAt: '2026-09-01T00:00:00.000Z' })
    reserveChatUsage.mockResolvedValue({ reservationId: 'r1', allowance: { limit: 25_000, used: 0, reserved: 10_000, remaining: 15_000, resetAt: '2026-09-01T00:00:00.000Z' } })
    finalizeChatUsage.mockResolvedValue({ limit: 25_000, used: 120, reserved: 0, remaining: 24_880, resetAt: '2026-09-01T00:00:00.000Z' })
    runWorkspaceChat.mockResolvedValue({ reply: 'llm reply', mode: 'llm', usage: { inputTokens: 100, outputTokens: 20 } })
  })

  it('GET returns history, availability, and monthly allowance for the owner', async () => {
    isWorkspaceChatConfigured.mockReturnValue(true)
    prismaMock.reportChatMessage.count.mockResolvedValue(2)
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(body.available).toBe(true)
    expect(body.allowance).toMatchObject({ limit: 25_000, remaining: 25_000 })
    expect(body.history).toBeUndefined()
    expect(prismaMock.reportChatMessage.findMany).toHaveBeenCalledWith(expect.objectContaining({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 40,
    }))
  })

  it('POST rejects a signed-out user with 401', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(401)
    expect(prismaMock.reportChatMessage.create).not.toHaveBeenCalled()
  })

  it('GET rejects a signed-out user with 401 and does not load history', async () => {
    getSession.mockResolvedValue(null)
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(401)
    expect(prismaMock.reportChatMessage.findMany).not.toHaveBeenCalled()
  })

  it('POST rejects a non-owner with 403', async () => {
    getSession.mockResolvedValue({ user: { id: 'other-user' } })
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(403)
    expect(prismaMock.reportChatMessage.create).not.toHaveBeenCalled()
  })

  it('POST rejects an LLM request when the monthly allowance cannot be reserved', async () => {
    reserveChatUsage.mockResolvedValue({ reservationId: null, allowance: { limit: 25_000, used: 25_000, reserved: 0, remaining: 0, resetAt: '2026-09-01T00:00:00.000Z' } })
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(body).toMatchObject({ code: 'CHAT_ALLOWANCE_EXHAUSTED', allowance: { remaining: 0 } })
    expect(prismaMock.reportChatMessage.createMany).not.toHaveBeenCalled()
  })

  it('POST persists the exchange and returns the LLM reply when configured', async () => {
    isWorkspaceChatConfigured.mockReturnValue(true)
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ reply: 'llm reply', mode: 'llm', allowance: { used: 120 } })
    expect(reserveChatUsage).toHaveBeenCalledOnce()
    expect(finalizeChatUsage).toHaveBeenCalledWith('r1', { inputTokens: 100, outputTokens: 20 })
    expect(prismaMock.reportChatMessage.createMany).toHaveBeenCalledWith({ data: [
      expect.objectContaining({ role: 'user', auditId: 'report-1' }),
      expect.objectContaining({ role: 'assistant', auditId: 'report-1' }),
    ] })
  })

  it('releases reserved usage and returns an explicit retry when chat fails', async () => {
    runWorkspaceChat.mockRejectedValue(new WorkspaceChatUnavailableError())
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(503)
    expect(await res.json()).toMatchObject({ code: 'CHAT_UNAVAILABLE', action: 'retry' })
    expect(releaseChatUsage).toHaveBeenCalledWith('r1')
    expect(prismaMock.reportChatMessage.createMany).not.toHaveBeenCalled()
  })

  it('maps a Redis availability failure into a 429 retry response', async () => {
    enforceRateLimit.mockRejectedValue(new RateLimitError(42))
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('42')
    expect(body.code).toBe('RATE_LIMITED')
    expect(body.action).toBe('retry')
  })
})
