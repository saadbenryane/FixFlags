import { beforeEach, describe, expect, it, vi } from 'vitest'

const getProgressiveAuditForRequest = vi.hoisted(() => vi.fn())
const getGatedAuditForRequest = vi.hoisted(() => vi.fn())

vi.mock('@/lib/audit/fetch-audit', () => ({
  getProgressiveAuditForRequest,
  getGatedAuditForRequest,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    audit: { findFirst: vi.fn() },
  },
}))
vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND')
  }),
}))

import { loadReportRouteState } from '@/app/report/[id]/load-report-route-state'

describe('loadReportRouteState progressive handoff', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    })

    const state = await loadReportRouteState(Promise.resolve({ id: 'audit-1' }))

    expect(state).toEqual({
      kind: 'progressive',
      id: 'audit-1',
      audit,
      session,
    })
    expect(getGatedAuditForRequest).not.toHaveBeenCalled()
  })

  it('preserves access denial before any completed-report work', async () => {
    getProgressiveAuditForRequest.mockResolvedValue({ kind: 'forbidden' })

    await expect(
      loadReportRouteState(Promise.resolve({ id: 'private-audit' }))
    ).resolves.toEqual({ kind: 'forbidden' })
    expect(getGatedAuditForRequest).not.toHaveBeenCalled()
  })
})
