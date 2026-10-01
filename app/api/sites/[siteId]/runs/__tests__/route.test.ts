import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireSiteAccess: vi.fn(),
  requestSiteRun: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.requireSiteAccess }))
vi.mock('@/lib/sites/application/run-requests', () => ({ requestSiteRun: mocks.requestSiteRun }))

import { POST } from '@/app/api/sites/[siteId]/runs/route'

function request(body: unknown, idempotencyKey = 'api:site:run:1') {
  return new NextRequest('http://localhost/api/sites/site-1/runs', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'idempotency-key': idempotencyKey },
    body: JSON.stringify(body),
  })
}

const context = { params: Promise.resolve({ siteId: 'site-1' }) }

describe('POST /api/sites/[siteId]/runs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1', projectId: 'project-1' } },
    })
    mocks.requestSiteRun.mockResolvedValue({
      runId: 'run-1', auditId: 'audit-1', outcomeIds: ['outcome-1'], reused: false,
    })
  })

  it('starts a durable tenant-scoped Site run', async () => {
    const response = await POST(request({ outcomeIds: ['outcome-1'] }), context)

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ runId: 'run-1', auditId: 'audit-1' })
    expect(mocks.requestSiteRun).toHaveBeenCalledWith({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      userId: 'user-1',
      source: 'WEB',
      scope: 'OUTCOMES',
      environment: 'production',
      idempotencyKey: 'api:site:run:1',
      context: { action: 'run_outcomes' },
    })
  })

  it('starts broad Site care without inventing an Outcome selection', async () => {
    mocks.requestSiteRun.mockResolvedValueOnce({
      runId: 'run-care', auditId: 'audit-care', outcomeIds: [], reused: false,
    })

    const response = await POST(request({ scope: 'site', outcomeIds: [] }, 'web:site-care:1'), context)

    expect(response.status).toBe(202)
    expect(await response.json()).toMatchObject({ runId: 'run-care', auditId: 'audit-care' })
    expect(mocks.requestSiteRun).toHaveBeenCalledWith({
      projectId: 'project-1',
      outcomeIds: [],
      userId: 'user-1',
      source: 'WEB',
      scope: 'SITE',
      environment: 'production',
      idempotencyKey: 'web:site-care:1',
      context: { action: 'run_site_care' },
    })
  })

  it('requires ownership before starting a run', async () => {
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'viewer', site: { siteId: 'site-1', projectId: 'project-1' } },
    })

    const response = await POST(request({ outcomeIds: ['outcome-1'] }), context)

    expect(response.status).toBe(403)
    expect(mocks.requestSiteRun).not.toHaveBeenCalled()
  })

  it('requires a bounded idempotency key and an explicit scope for an empty selection', async () => {
    const missingKey = await POST(request({ outcomeIds: ['outcome-1'] }, ''), context)
    const emptySelection = await POST(request({ outcomeIds: [] }), context)

    expect(missingKey.status).toBe(400)
    expect(emptySelection.status).toBe(400)
    expect(mocks.requestSiteRun).not.toHaveBeenCalled()
  })
})
