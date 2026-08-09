import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({ audit: { findMany: vi.fn(), findFirst: vi.fn() } }))
vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { loadReportHistory } from '@/lib/audit/report-history'

describe('loadReportHistory', () => {
  beforeEach(() => vi.clearAllMocks())

  it('scopes, orders, and cursor-paginates account reports', async () => {
    prismaMock.audit.findMany.mockResolvedValue([
      {
        id: 'a2', url: 'https://example.com/two', createdAt: new Date('2026-08-02T00:00:00Z'),
        completedAt: new Date('2026-08-02T00:01:00Z'), status: 'COMPLETED', score: 81,
        parentId: 'a1', projectId: 'p1', _count: { flags: 2 },
      },
      {
        id: 'a1', url: 'https://example.com/', createdAt: new Date('2026-08-01T00:00:00Z'),
        completedAt: null, status: 'CHECKING', score: null,
        parentId: null, projectId: 'p1', _count: { flags: 1 },
      },
    ])
    const result = await loadReportHistory({ userId: 'u1', limit: 1 })
    expect(prismaMock.audit.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { userId: 'u1' }, take: 2,
    }))
    expect(result.items).toEqual([expect.objectContaining({
      id: 'a2', hostname: 'example.com', reviewKind: 'update_review', unresolvedFlagCount: 2,
    })])
    expect(result.nextCursor).toBe('a2')
  })

  it('rejects a cursor outside the authenticated account scope', async () => {
    prismaMock.audit.findFirst.mockResolvedValue(null)
    await expect(loadReportHistory({ userId: 'u1', cursor: 'other-user-audit' }))
      .rejects.toThrow('Invalid report history cursor')
    expect(prismaMock.audit.findMany).not.toHaveBeenCalled()
  })
})
