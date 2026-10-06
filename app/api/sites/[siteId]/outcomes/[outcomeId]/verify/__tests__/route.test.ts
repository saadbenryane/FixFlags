import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireSiteAccess: vi.fn(),
  requestOutcomeRun: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.requireSiteAccess }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestOutcomeRun: mocks.requestOutcomeRun }))

import { POST } from '@/app/api/sites/[siteId]/outcomes/[outcomeId]/verify/route'

function request() {
  return new NextRequest('http://localhost/api/sites/site-1/outcomes/outcome-1/verify', {
    method: 'POST',
    headers: { 'idempotency-key': 'web:outcome-1:1' },
  })
}

const context = { params: Promise.resolve({ siteId: 'site-1', outcomeId: 'outcome-1' }) }

describe('POST /api/sites/[siteId]/outcomes/[outcomeId]/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1', projectId: 'project-1' } },
    })
  })

  it('returns the refusal reason when another Site run is already in progress', async () => {
    mocks.requestOutcomeRun.mockRejectedValue(new SiteRunRefusal('Another Site run is already in progress', 409))

    const response = await POST(request(), context)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.message).toBe('Another Site run is already in progress')
    expect(body.message).not.toBe('Could not start this verification')
  })

  it('keeps an unexpected failure generic', async () => {
    mocks.requestOutcomeRun.mockRejectedValue(new Error('database exploded'))

    const response = await POST(request(), context)
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.message).toBe('Could not start this verification')
    expect(body.message).not.toContain('database exploded')
  })
})
