import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProgressiveAuditForRequest = vi.hoisted(() => vi.fn())
const getGatedAuditForRequest = vi.hoisted(() => vi.fn())
const resolveActiveAttachedWorkId = vi.hoisted(() => vi.fn())
const auditFindMany = vi.hoisted(() => vi.fn())
const auditFindUnique = vi.hoisted(() => vi.fn())
const redirect = vi.hoisted(() =>
  vi.fn((href: string) => {
    throw new Error(`NEXT_REDIRECT:${href}`)
  }),
)

vi.mock('@/lib/audit/fetch-audit', () => ({
  getProgressiveAuditForRequest,
  getGatedAuditForRequest,
  resolveActiveAttachedWorkId,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    audit: {
      findFirst: vi.fn(),
      findMany: auditFindMany,
      findUnique: auditFindUnique,
    },
  },
}))
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => undefined }) }))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
  redirect,
}))

import {
  loadCompletedReviewHistoryRows,
  loadReportRouteState,
} from '@/app/report/[id]/load-report-route-state'

describe('loadReportRouteState progressive handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveActiveAttachedWorkId.mockImplementation(async (id: string) => id)
  })

  it('redirects a parent bookmark to the in-flight attached Update review', async () => {
    resolveActiveAttachedWorkId.mockResolvedValueOnce('child-active')

    await expect(
      loadReportRouteState(Promise.resolve({ id: 'parent-completed' })),
    ).rejects.toThrow('NEXT_REDIRECT:/report/child-active')
    expect(getProgressiveAuditForRequest).not.toHaveBeenCalled()
  })

  it('returns the lightweight progressive state without loading the completed graph', async () => {
    const audit = {
      id: 'audit-1',
      url: 'https://example.com/',
      status: 'CAPTURING',
      progress: 20,
      screenshots: [],
      rubrics: [],
      flags: [],
    }
    const session = { user: { id: 'user-1' } }
    getProgressiveAuditForRequest.mockResolvedValue({
      kind: 'progressive',
      audit,
      session,
      accessContext: 'owner',
    })

    const state = await loadReportRouteState(Promise.resolve({ id: 'audit-1' }))

    expect(state).toEqual({
      kind: 'progressive',
      id: 'audit-1',
      audit: { ...audit, accessContext: 'owner' },
      session,
      atAuditLimit: false,
    })
    expect(getGatedAuditForRequest).not.toHaveBeenCalled()
  })

  it('polls the work audit id when progressive data is for attached work', async () => {
    const audit = {
      id: 'child-work',
      url: 'https://example.com/',
      status: 'CHECKING',
      progress: 40,
      screenshots: [],
      rubrics: [],
      flags: [],
    }
    getProgressiveAuditForRequest.mockResolvedValue({
      kind: 'progressive',
      audit,
      session: null,
      accessContext: 'owner',
    })

    const state = await loadReportRouteState(Promise.resolve({ id: 'child-work' }))

    expect(state).toMatchObject({
      kind: 'progressive',
      id: 'child-work',
    })
  })

  it('scopes Product history to the current project without an account-wide cap', async () => {
    auditFindMany.mockResolvedValueOnce([])

    await loadCompletedReviewHistoryRows({
      auditId: 'review-2',
      userId: 'user-1',
      projectId: 'product-1',
    })

    expect(auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'product-1',
          userId: 'user-1',
          status: 'COMPLETED',
        },
      }),
    )
    expect(auditFindMany.mock.calls[0]?.[0]).not.toHaveProperty('take')
  })

  it('walks a legacy parent chain without loading unrelated account Reviews', async () => {
    const root = {
      id: 'review-1',
      userId: 'user-1',
      projectId: null,
      parentId: null,
      recheckTrigger: null,
      score: 60,
      status: 'COMPLETED',
      createdAt: new Date('2026-08-01T00:00:00Z'),
      completedAt: new Date('2026-08-01T00:01:00Z'),
    }
    const update = {
      ...root,
      id: 'review-2',
      parentId: 'review-1',
      score: 74,
      createdAt: new Date('2026-08-02T00:00:00Z'),
      completedAt: new Date('2026-08-02T00:01:00Z'),
    }
    auditFindUnique
      .mockResolvedValueOnce(update)
      .mockResolvedValueOnce(root)
    auditFindMany
      .mockResolvedValueOnce([update])
      .mockResolvedValueOnce([])

    const rows = await loadCompletedReviewHistoryRows({
      auditId: 'review-2',
      userId: 'user-1',
      projectId: null,
    })

    expect(rows.map((row) => row.id).sort()).toEqual(['review-1', 'review-2'])
    expect(auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          parentId: { in: ['review-1'] },
          userId: 'user-1',
          status: 'COMPLETED',
        },
      }),
    )
  })

  it('preserves access denial before any completed-report work', async () => {
    getProgressiveAuditForRequest.mockResolvedValue({ kind: 'forbidden' })

    await expect(
      loadReportRouteState(Promise.resolve({ id: 'private-audit' }))
    ).resolves.toEqual({ kind: 'forbidden' })
    expect(getGatedAuditForRequest).not.toHaveBeenCalled()
  })
})
