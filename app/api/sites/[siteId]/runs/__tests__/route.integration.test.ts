import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireSiteAccess: vi.fn(),
  outcomeFindMany: vi.fn(),
  projectFindFirst: vi.fn(),
  runFindUnique: vi.fn(),
  runFindFirst: vi.fn(),
  runFindMany: vi.fn(),
  runCreate: vi.fn(),
  runUpdate: vi.fn(),
  runUpdateMany: vi.fn(),
  runCount: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindUnique: vi.fn(),
  createAudit: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.requireSiteAccess }))
vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findMany: mocks.outcomeFindMany },
    project: { findFirst: mocks.projectFindFirst },
    runRequest: {
      findUnique: mocks.runFindUnique,
      findFirst: mocks.runFindFirst,
      findMany: mocks.runFindMany,
      create: mocks.runCreate,
      update: mocks.runUpdate,
      updateMany: mocks.runUpdateMany,
      count: mocks.runCount,
    },
    audit: { findFirst: mocks.auditFindFirst, findUnique: mocks.auditFindUnique },
  },
}))
vi.mock('@/lib/audit/create-audit', () => ({ createAndEnqueueAudit: mocks.createAudit }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn().mockResolvedValue({}) }))

import { POST } from '@/app/api/sites/[siteId]/runs/route'

describe('POST /api/sites/[siteId]/runs Site-care integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1', projectId: 'project-1' } },
    })
    mocks.outcomeFindMany.mockResolvedValue([])
    mocks.projectFindFirst.mockResolvedValue({ url: 'https://shop.example/' })
    mocks.runFindUnique.mockResolvedValue(null)
    mocks.runFindFirst.mockResolvedValue(null)
    mocks.runFindMany.mockResolvedValue([])
    mocks.runCreate.mockResolvedValue({ id: 'run-care' })
    mocks.runUpdate.mockResolvedValue({})
    mocks.runUpdateMany.mockResolvedValue({ count: 0 })
    mocks.runCount.mockResolvedValue(0)
    mocks.auditFindFirst.mockResolvedValue({ id: 'audit-parent' })
    mocks.auditFindUnique.mockResolvedValue(null)
    mocks.createAudit.mockResolvedValue({ auditId: 'audit-care', reused: false })
  })

  it('crosses the authenticated route into the shared RunRequest and physical Audit ledger', async () => {
    const request = new NextRequest('http://localhost/api/sites/site-1/runs', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'idempotency-key': 'web:site-care:integration' },
      body: JSON.stringify({ scope: 'site', outcomeIds: [] }),
    })

    const response = await POST(request, { params: Promise.resolve({ siteId: 'site-1' }) })

    expect(response.status).toBe(202)
    expect(await response.json()).toEqual({
      runId: 'run-care', auditId: 'audit-care', outcomeIds: [], reused: false,
    })
    expect(mocks.runCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        projectId: 'project-1', source: 'WEB', selections: undefined,
        context: { action: 'run_site_care' },
      }),
    }))
    expect(mocks.createAudit).toHaveBeenCalledWith(expect.objectContaining({
      url: 'https://shop.example/', parentId: 'audit-parent', runRequestId: 'run-care',
    }))
  })
})
