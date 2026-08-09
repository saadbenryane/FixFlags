import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const getSession = vi.hoisted(() => vi.fn())
const loadReportHistory = vi.hoisted(() => vi.fn())
const InvalidReportHistoryCursorError = vi.hoisted(() => class InvalidReportHistoryCursorError extends Error {})
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/audit/report-history', () => ({ loadReportHistory, InvalidReportHistoryCursorError }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import { GET } from '@/app/api/reports/history/route'

const request = { nextUrl: { searchParams: new URLSearchParams('cursor=a1') } } as NextRequest

describe('GET /api/reports/history', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires authentication', async () => {
    getSession.mockResolvedValue(null)
    expect((await GET(request)).status).toBe(401)
    expect(loadReportHistory).not.toHaveBeenCalled()
  })

  it('returns the owner-scoped cursor page', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    loadReportHistory.mockResolvedValue({ items: [], nextCursor: null })
    const response = await GET(request)
    expect(response.status).toBe(200)
    expect(loadReportHistory).toHaveBeenCalledWith({ userId: 'u1', cursor: 'a1' })
  })

  it('rejects a cursor that is not scoped to the account', async () => {
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    loadReportHistory.mockRejectedValue(new InvalidReportHistoryCursorError())
    expect((await GET(request)).status).toBe(400)
  })
})
