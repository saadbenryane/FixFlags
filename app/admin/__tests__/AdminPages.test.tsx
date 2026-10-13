import { beforeEach, describe, expect, it, vi } from 'vitest'
import AdminUsersPage from '@/app/admin/users/page'
import AdminAuditsPage from '@/app/admin/audits/page'
import AdminLeadsPage from '@/app/admin/leads/page'
import AdminFeedbackPage from '@/app/admin/feedback/page'

const state = vi.hoisted(() => ({
  guard: vi.fn(),
  userCount: vi.fn(),
  userFind: vi.fn(),
  auditCount: vi.fn(),
  auditFind: vi.fn(),
  leadCount: vi.fn(),
  leadFind: vi.fn(),
  closeOrphans: vi.fn(),
  reportFeedback: vi.fn(),
  flagFeedback: vi.fn(),
}))
vi.mock('@/lib/auth/require-admin-page', () => ({ requireAdminPage: state.guard }))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { count: state.userCount, findMany: state.userFind },
    audit: { count: state.auditCount, findMany: state.auditFind },
    lead: { count: state.leadCount, findMany: state.leadFind },
    creditPurchase: {
      aggregate: vi.fn().mockResolvedValue({ _count: 0, _sum: {} }),
      groupBy: vi.fn().mockResolvedValue([]),
    },
    auditFeedback: { findMany: state.reportFeedback },
    flagFeedback: { findMany: state.flagFeedback },
  },
}))
vi.mock('@/lib/billing/costs', () => ({ formatUsd: () => '$0' }))
vi.mock('@/lib/live-support/sessions', () => ({
  closeOrphanSupportSessions: state.closeOrphans,
  getAdminUnreadCount: vi.fn().mockResolvedValue(0),
}))

describe('admin data entry points', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    state.guard.mockResolvedValue({ id: 'admin' })
    for (const count of [state.userCount, state.auditCount, state.leadCount])
      count.mockResolvedValue(251)
    for (const find of [state.userFind, state.auditFind, state.leadFind]) find.mockResolvedValue([])
  })

  it('does not read users, checks, or leads when access is denied', async () => {
    state.guard.mockRejectedValue(new Error('forbidden'))
    for (const Page of [AdminUsersPage, AdminAuditsPage, AdminLeadsPage]) {
      await expect(Page({ searchParams: Promise.resolve({}) })).rejects.toThrow('forbidden')
    }
    expect(state.userCount).not.toHaveBeenCalled()
    expect(state.auditCount).not.toHaveBeenCalled()
    expect(state.leadCount).not.toHaveBeenCalled()
  })

  it('does not clean up conversations or load feedback when access is denied', async () => {
    state.guard.mockRejectedValue(new Error('forbidden'))
    await expect(AdminFeedbackPage()).rejects.toThrow('forbidden')
    expect(state.closeOrphans).not.toHaveBeenCalled()
    expect(state.reportFeedback).not.toHaveBeenCalled()
    expect(state.flagFeedback).not.toHaveBeenCalled()
  })

  it('applies the same user search to the count and the paginated rows', async () => {
    await AdminUsersPage({ searchParams: Promise.resolve({ q: 'alice', page: '5' }) })
    const where = state.userCount.mock.calls[0][0].where
    expect(where.OR).toContainEqual({ email: { contains: 'alice', mode: 'insensitive' } })
    expect(state.userFind).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 200, take: 50 }),
    )
  })

  it('combines failed status and search when drilling into checks', async () => {
    await AdminAuditsPage({
      searchParams: Promise.resolve({ q: 'example.com', status: 'FAILED', page: '2' }),
    })
    const where = state.auditCount.mock.calls[0][0].where
    expect(where.status).toBe('FAILED')
    expect(state.auditFind).toHaveBeenCalledWith(
      expect.objectContaining({ where, skip: 50, take: 50 }),
    )
  })

  it('keeps the low-potential OR condition while adding a search', async () => {
    await AdminLeadsPage({
      searchParams: Promise.resolve({ q: 'example', potential: 'low', status: 'NEW' }),
    })
    const where = state.leadCount.mock.calls[0][0].where
    expect(where.OR).toHaveLength(2)
    expect(where.AND[0].OR[0]).toEqual({
      normalizedDomain: { contains: 'example', mode: 'insensitive' },
    })
    expect(state.leadFind).toHaveBeenCalledWith(expect.objectContaining({ where, take: 50 }))
  })
})
