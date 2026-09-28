import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireSiteAccess: vi.fn(),
  executeSiteCommand: vi.fn(),
  allowedWatchIntervals: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.requireSiteAccess }))
vi.mock('@/lib/sites/application/commands', () => ({ executeSiteCommand: mocks.executeSiteCommand }))
vi.mock('@/lib/auth/entitlements', () => ({ allowedWatchIntervals: mocks.allowedWatchIntervals }))
vi.mock('@/lib/db', () => ({ prisma: { user: { findUnique: vi.fn() } } }))

import { POST } from '@/app/api/sites/[siteId]/watch/route'
import { prisma } from '@/lib/db'

const context = { params: Promise.resolve({ siteId: 'site-1' }) }

const DAILY_ON_FREE =
  'Daily watching is available on Pro and Studio. Free Sites watch weekly.'

function request(interval: 'weekly' | 'daily' | null) {
  return new NextRequest('http://localhost/api/sites/site-1/watch', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ interval }),
  })
}

describe('POST /api/sites/[siteId]/watch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1', projectId: 'project-1' } },
    })
    mocks.executeSiteCommand.mockResolvedValue({ ok: true })
    mocks.allowedWatchIntervals.mockReturnValue(['weekly'])
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      plan: 'FREE',
      subscriptionStatus: 'ACTIVE',
      role: 'user',
      id: 'user-1',
    } as never)
  })

  it('requires sign-in', async () => {
    mocks.getSession.mockResolvedValue(null)
    const response = await POST(request('weekly'), context)
    expect(response.status).toBe(401)
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })

  it('saves the requested cadence without rewriting it', async () => {
    mocks.allowedWatchIntervals.mockReturnValue(['weekly', 'daily'])
    const response = await POST(request('daily'), context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, interval: 'daily' })
    expect(mocks.executeSiteCommand).toHaveBeenCalledTimes(1)
    expect(mocks.executeSiteCommand).toHaveBeenCalledWith({
      type: 'SET_WATCH',
      siteId: 'site-1',
      userId: 'user-1',
      interval: 'daily',
    })
  })

  it('pauses Watch when the interval is null', async () => {
    const response = await POST(request(null), context)

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ ok: true, interval: null })
  })

  it('never saves daily for a plan that cannot watch daily', async () => {
    mocks.executeSiteCommand
      .mockResolvedValueOnce({
        ok: false,
        error: DAILY_ON_FREE,
        code: 'INTERVAL_NOT_ALLOWED',
      })
      .mockResolvedValueOnce({ ok: true })

    const response = await POST(request('daily'), context)

    expect(response.status).toBe(200)
    // The applied cadence is weekly. Daily was requested, saved weekly, and the
    // reason travels with the response so the client can say so out loud.
    expect(await response.json()).toEqual({
      ok: true,
      interval: 'weekly',
      requested: 'daily',
      code: 'INTERVAL_NOT_ALLOWED',
      message: DAILY_ON_FREE,
    })
    const intervals = mocks.executeSiteCommand.mock.calls.map((call) => call[0].interval)
    expect(intervals).toEqual(['daily', 'weekly'])
  })

  it('does not fall back to a cadence the plan does not allow', async () => {
    mocks.allowedWatchIntervals.mockReturnValue([])
    mocks.executeSiteCommand.mockResolvedValue({
      ok: false,
      error: 'Watching is not available on this account.',
      code: 'WATCH_UNAVAILABLE',
    })

    const response = await POST(request('daily'), context)

    expect(response.status).toBe(503)
    expect(mocks.executeSiteCommand).toHaveBeenCalledTimes(1)
  })

  it('surfaces a domain rejection instead of answering ok', async () => {
    mocks.executeSiteCommand.mockResolvedValue({
      ok: false,
      error: 'Confirm an Outcome before Watch can verify this Site.',
      code: 'WATCH_UNAVAILABLE',
    })

    const response = await POST(request('weekly'), context)

    expect(response.status).toBe(503)
    expect(await response.json()).toMatchObject({
      code: 'WATCH_UNAVAILABLE',
      message: 'Confirm an Outcome before Watch can verify this Site.',
    })
  })

  it('rejects an interval the product does not offer', async () => {
    const invalid = new NextRequest('http://localhost/api/sites/site-1/watch', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ interval: 'hourly' }),
    })
    const response = await POST(invalid, context)

    expect(response.status).toBe(400)
    expect(mocks.executeSiteCommand).not.toHaveBeenCalled()
  })
})
