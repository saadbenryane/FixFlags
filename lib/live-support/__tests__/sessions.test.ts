import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SUPPORT_WELCOME_MESSAGE } from '@/lib/help/sla'
import { SUPPORT_VISITOR_COOKIE } from '@/lib/live-support/types'
import { serializeSession, serializeMessage } from '@/lib/live-support/messages'
import { extractAuditIdFromPath, extractAuditIdFromPageUrl } from '@/lib/live-support/extract-audit-id'

const mockTenant = { id: 'tenant_1', slug: 'fixflags' }
const mockSession = {
  id: 'sess_1',
  status: 'OPEN' as const,
  visitorName: null,
  visitorEmail: null,
  pageUrl: 'https://fixflags.com/report/aud_abc',
  lastMessageAt: new Date('2026-07-20T12:00:00Z'),
  unreadByVisitor: 0,
  unreadByAgent: 1,
  createdAt: new Date('2026-07-20T11:00:00Z'),
}

const {
  mockFindFirst,
  mockCreate,
  mockUpdate,
  mockMessageCreate,
  mockGetTenant,
  mockResolveLead,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockGetTenant: vi.fn(),
  mockResolveLead: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    supportSession: {
      findFirst: mockFindFirst,
      create: mockCreate,
      update: mockUpdate,
    },
    supportMessage: {
      create: mockMessageCreate,
    },
  },
}))

vi.mock('@/lib/live-support/tenant', () => ({
  getDefaultSupportTenant: mockGetTenant,
}))

vi.mock('@/lib/live-support/resolve-lead-context', () => ({
  resolveLeadIdForSession: mockResolveLead,
}))

describe('live-support serialize', () => {
  it('serializes session and message DTOs', () => {
    const session = serializeSession(mockSession)
    expect(session.id).toBe('sess_1')
    expect(session.pageUrl).toContain('/report/')
    expect(session.unreadByAgent).toBe(1)

    const message = serializeMessage({
      id: 'msg_1',
      role: 'VISITOR',
      body: 'Hello',
      createdAt: new Date('2026-07-20T12:01:00Z'),
      senderId: null,
    })
    expect(message.role).toBe('VISITOR')
    expect(message.body).toBe('Hello')
  })
})

describe('live-support audit extraction', () => {
  it('extracts audit ids from paths and page URLs', () => {
    expect(extractAuditIdFromPath('/report/cmabc123')).toBe('cmabc123')
    expect(extractAuditIdFromPageUrl('https://fixflags.com/report/cmabc123')).toBe('cmabc123')
    expect(extractAuditIdFromPageUrl(null)).toBeNull()
  })
})

describe('resumeOrCreateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTenant.mockResolvedValue(mockTenant)
    mockResolveLead.mockResolvedValue(null)
  })

  it('creates a session with the canonical welcome SYSTEM message', async () => {
    mockFindFirst.mockResolvedValue(null)
    mockCreate.mockResolvedValue(mockSession)
    mockMessageCreate.mockResolvedValue({})

    const { resumeOrCreateSession } = await import('@/lib/live-support/sessions')
    const session = await resumeOrCreateSession({
      visitorToken: 'v_test',
      pageUrl: 'https://fixflags.com/help',
    })

    expect(session.id).toBe('sess_1')
    expect(mockMessageCreate).toHaveBeenCalledWith({
      data: {
        sessionId: 'sess_1',
        role: 'SYSTEM',
        body: SUPPORT_WELCOME_MESSAGE,
      },
    })
  })

  it('resumes an existing open session', async () => {
    mockFindFirst.mockResolvedValue(mockSession)
    mockUpdate.mockResolvedValue({ ...mockSession, pageUrl: 'https://fixflags.com/pricing' })

    const { resumeOrCreateSession } = await import('@/lib/live-support/sessions')
    const session = await resumeOrCreateSession({
      visitorToken: 'v_test',
      pageUrl: 'https://fixflags.com/pricing',
    })

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockMessageCreate).not.toHaveBeenCalled()
    expect(session.pageUrl).toContain('pricing')
  })
})

describe('visitor cookie name', () => {
  it('uses the ff_support_visitor cookie', () => {
    expect(SUPPORT_VISITOR_COOKIE).toBe('ff_support_visitor')
  })
})
