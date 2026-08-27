import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SUPPORT_WELCOME_MESSAGE } from '@/lib/help/sla'
import { SUPPORT_VISITOR_COOKIE } from '@/lib/live-support/types'
import { serializeSession, serializeMessage } from '@/lib/live-support/messages'
import { extractAuditIdFromPath, extractAuditIdFromPageUrl } from '@/lib/live-support/extract-audit-id'

const mockTenant = { id: 'tenant_1', slug: 'fixflags' }
const mockSession = {
  id: 'sess_1',
  status: 'WAITING' as const,
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
  mockFindUniqueOrThrow,
  mockCreate,
  mockUpdate,
  mockUpdateMany,
  mockCount,
  mockAggregate,
  mockFindMany,
  mockMessageCreate,
  mockGetTenant,
  mockResolveLead,
  mockTransaction,
  mockNotify,
  mockSendVisitorMessage,
} = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockFindUniqueOrThrow: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockUpdateMany: vi.fn(),
  mockCount: vi.fn(),
  mockAggregate: vi.fn(),
  mockFindMany: vi.fn(),
  mockMessageCreate: vi.fn(),
  mockGetTenant: vi.fn(),
  mockResolveLead: vi.fn(),
  mockTransaction: vi.fn(),
  mockNotify: vi.fn(),
  mockSendVisitorMessage: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    supportSession: {
      findFirst: mockFindFirst,
      findUniqueOrThrow: mockFindUniqueOrThrow,
      create: mockCreate,
      update: mockUpdate,
      updateMany: mockUpdateMany,
      count: mockCount,
      aggregate: mockAggregate,
      findMany: mockFindMany,
    },
    supportMessage: {
      create: mockMessageCreate,
    },
    audit: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    $transaction: mockTransaction,
  },
}))

vi.mock('@/lib/live-support/tenant', () => ({
  getDefaultSupportTenant: mockGetTenant,
}))

vi.mock('@/lib/live-support/resolve-lead-context', () => ({
  resolveLeadIdForSession: mockResolveLead,
}))

vi.mock('@/lib/live-support/notify', () => ({
  notifyAdminOfVisitorMessage: mockNotify,
}))

vi.mock('@/lib/live-support/messages', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/live-support/messages')>()
  return {
    ...actual,
    sendVisitorMessage: mockSendVisitorMessage,
  }
})

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
    mockNotify.mockResolvedValue(undefined)
    mockSendVisitorMessage.mockResolvedValue({})
  })

  it('returns null without firstMessage when no active conversation exists', async () => {
    mockFindFirst.mockResolvedValue(null)

    const { resumeOrCreateSession } = await import('@/lib/live-support/sessions')
    const session = await resumeOrCreateSession({
      visitorToken: 'v_test',
      pageUrl: 'https://fixflags.com/help',
    })

    expect(session).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockMessageCreate).not.toHaveBeenCalled()
  })

  it('creates WAITING session with SYSTEM welcome and visitor firstMessage', async () => {
    mockFindFirst.mockResolvedValue(null)
    const created = { ...mockSession, status: 'WAITING' as const, lastMessageAt: null }
    const withLast = { ...mockSession, status: 'WAITING' as const }

    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = {
        supportSession: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(created),
          update: vi.fn().mockResolvedValue(withLast),
        },
        supportMessage: {
          create: vi
            .fn()
            .mockResolvedValueOnce({ id: 'sys_1' })
            .mockResolvedValueOnce({ id: 'vis_1', createdAt: new Date('2026-07-20T12:00:00Z') }),
        },
      }
      return fn(tx)
    })

    const { resumeOrCreateSession } = await import('@/lib/live-support/sessions')
    const session = await resumeOrCreateSession({
      visitorToken: 'v_test',
      pageUrl: 'https://fixflags.com/help',
      firstMessage: 'Hello team',
    })

    expect(session?.id).toBe('sess_1')
    expect(session?.status).toBe('WAITING')
    expect(mockNotify).toHaveBeenCalledWith('sess_1', 'Hello team')
  })

  it('resumes an existing conversation without creating', async () => {
    mockFindFirst.mockResolvedValue(mockSession)
    mockUpdate.mockResolvedValue({ ...mockSession, pageUrl: 'https://fixflags.com/pricing' })

    const { resumeOrCreateSession } = await import('@/lib/live-support/sessions')
    const session = await resumeOrCreateSession({
      visitorToken: 'v_test',
      pageUrl: 'https://fixflags.com/pricing',
    })

    expect(mockUpdate).toHaveBeenCalled()
    expect(mockCreate).not.toHaveBeenCalled()
    expect(mockMessageCreate).not.toHaveBeenCalled()
    expect(session?.pageUrl).toContain('pricing')
  })

  it('appends firstMessage to an existing conversation via sendVisitorMessage', async () => {
    mockFindFirst.mockResolvedValue(mockSession)
    mockUpdate.mockResolvedValue(mockSession)
    mockFindUniqueOrThrow.mockResolvedValue({ ...mockSession, unreadByAgent: 2 })

    const { resumeOrCreateSession } = await import('@/lib/live-support/sessions')
    await resumeOrCreateSession({
      visitorToken: 'v_test',
      firstMessage: 'Follow up',
    })

    expect(mockSendVisitorMessage).toHaveBeenCalledWith('sess_1', 'Follow up')
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('listAdminSessions and orphan cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetTenant.mockResolvedValue(mockTenant)
  })

  it('open filter requires lastMessageAt', async () => {
    mockFindMany.mockResolvedValue([])

    const { listAdminSessions } = await import('@/lib/live-support/sessions')
    await listAdminSessions('open')

    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tenantId: 'tenant_1',
          status: { in: ['OPEN', 'WAITING', 'ACTIVE'] },
          lastMessageAt: { not: null },
        }),
      })
    )
  })

  it('closes orphan active sessions with null lastMessageAt', async () => {
    mockUpdateMany.mockResolvedValue({ count: 14 })

    const { closeOrphanSupportSessions } = await import('@/lib/live-support/sessions')
    const closed = await closeOrphanSupportSessions()

    expect(closed).toBe(14)
    expect(mockUpdateMany).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant_1',
        status: { in: ['OPEN', 'WAITING', 'ACTIVE'] },
        lastMessageAt: null,
      },
      data: { status: 'CLOSED' },
    })
  })

  it('countOpenConversations requires lastMessageAt', async () => {
    mockCount.mockResolvedValue(3)

    const { countOpenConversations } = await import('@/lib/live-support/sessions')
    const n = await countOpenConversations()

    expect(n).toBe(3)
    expect(mockCount).toHaveBeenCalledWith({
      where: {
        tenantId: 'tenant_1',
        status: { in: ['OPEN', 'WAITING', 'ACTIVE'] },
        lastMessageAt: { not: null },
      },
    })
  })
})

describe('visitor cookie name', () => {
  it('uses the ff_support_visitor cookie', () => {
    expect(SUPPORT_VISITOR_COOKIE).toBe('ff_support_visitor')
  })
})

describe('welcome copy', () => {
  it('keeps SYSTEM welcome aligned with SUPPORT_CHAT', async () => {
    const { SUPPORT_CHAT } = await import('@/lib/marketing/copy')
    expect(SUPPORT_WELCOME_MESSAGE).toBe(SUPPORT_CHAT.welcomeMessage)
  })
})
