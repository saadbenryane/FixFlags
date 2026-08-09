import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
  reportChatMessage: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  flag: { findMany: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())
const requestClientId = vi.hoisted(() => vi.fn(() => 'test-client'))
const buildCannedChatReply = vi.hoisted(() => vi.fn())
const isWorkspaceChatConfigured = vi.hoisted(() => vi.fn())
const runWorkspaceChat = vi.hoisted(() => vi.fn())
const answerProductQuestion = vi.hoisted(() => vi.fn())
const getEnv = vi.hoisted(() => vi.fn())
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
  buildCannedChatReply,
  isWorkspaceChatConfigured,
  runWorkspaceChat,
}))
vi.mock('@/lib/env', () => ({ getEnv }))
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
    prismaMock.flag.findMany.mockResolvedValue([])
    prismaMock.reportChatMessage.count.mockResolvedValue(0)
    prismaMock.reportChatMessage.findMany.mockResolvedValue([historyMessage])
    prismaMock.reportChatMessage.create.mockResolvedValue({})
    getEnv.mockReturnValue({ CHAT_SESSION_CAP: '20' })
    buildCannedChatReply.mockReturnValue('canned reply')
    runWorkspaceChat.mockResolvedValue({ reply: 'llm reply', mode: 'llm' })
  })

  it('GET returns history, user turns, cap, and availability for the owner', async () => {
    isWorkspaceChatConfigured.mockReturnValue(true)
    prismaMock.reportChatMessage.count.mockResolvedValue(2)
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }])
    expect(body.available).toBe(true)
    expect(body.cap).toBe(20)
    expect(body.userTurns).toBe(2)
    expect(body.history).toBeUndefined()
  })

  it('POST rejects a signed-out user with 401', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(401)
    expect(prismaMock.reportChatMessage.create).not.toHaveBeenCalled()
  })

  it('POST rejects a non-owner with 403', async () => {
    getSession.mockResolvedValue({ user: { id: 'other-user' } })
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    expect(res.status).toBe(403)
    expect(prismaMock.reportChatMessage.create).not.toHaveBeenCalled()
  })

  it('POST degrades to a canned reply when the per-plan user cap is reached', async () => {
    getEnv.mockReturnValue({ CHAT_SESSION_CAP: '3' })
    prismaMock.reportChatMessage.count.mockResolvedValue(3)
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ reply: 'canned reply', mode: 'canned', capReached: true, cap: 3 })
    expect(prismaMock.reportChatMessage.create).not.toHaveBeenCalled()
  })

  it('POST persists the exchange and returns the LLM reply when configured', async () => {
    isWorkspaceChatConfigured.mockReturnValue(true)
    const res = await POST(getReq(), { params: Promise.resolve({ id: 'report-1' }) })
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body).toMatchObject({ reply: 'llm reply', mode: 'llm', cap: 20, userTurns: 1 })
    expect(prismaMock.reportChatMessage.create).toHaveBeenCalledTimes(2)
    expect(prismaMock.reportChatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ role: 'user', auditId: 'report-1' }) })
    )
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
