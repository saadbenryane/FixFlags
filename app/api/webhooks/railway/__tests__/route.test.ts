import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockValidateApiKey = vi.hoisted(() => vi.fn())
const mockRequestSiteRun = vi.hoisted(() => vi.fn())
const mockRequestSiteCareRun = vi.hoisted(() => vi.fn())
const mockProjectFindFirst = vi.hoisted(() => vi.fn())
const mockRecordProductReleaseForReview = vi.hoisted(() => vi.fn())

vi.mock('@/lib/mcp/tools', () => ({
  validateApiKey: mockValidateApiKey,
}))
vi.mock('@/lib/db', () => ({
  prisma: { project: { findFirst: mockProjectFindFirst } },
}))
vi.mock('@/lib/sites/application/run-requests', () => ({
  requestSiteRun: mockRequestSiteRun,
  requestSiteCareRun: mockRequestSiteCareRun,
}))
vi.mock('@/lib/signals/product-signals', () => ({
  recordProductReleaseForReview: mockRecordProductReleaseForReview,
}))

import { POST } from '@/app/api/webhooks/railway/route'

function successPayload(type = 'DEPLOY_SUCCESS') {
  return {
    type,
    deployment: { status: 'SUCCESS', id: 'dep-1' },
    resource: {
      project: { name: 'my-app' },
      environment: { name: 'production' },
      service: { name: 'web' },
    },
  }
}

function request(url: string, init?: { headers?: Record<string, string>; body?: string }) {
  return new NextRequest(url, {
    method: 'POST',
    headers: init?.headers,
    body: init?.body ?? JSON.stringify(successPayload()),
  })
}

describe('POST /api/webhooks/railway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RAILWAY_WEBHOOK_SECRET
    mockValidateApiKey.mockResolvedValue({
      user: { id: 'user-1' },
      apiKey: { id: 'api-key-1', client: 'cli', scopes: [], audience: null },
    })
    mockProjectFindFirst.mockResolvedValue({
      id: 'project-1',
      siteOutcomes: [{ id: 'outcome-1' }],
    })
    mockRequestSiteRun.mockResolvedValue({
      runId: 'run-1',
      auditId: 'audit-1',
      outcomeIds: ['outcome-1'],
      reused: false,
    })
    mockRecordProductReleaseForReview.mockResolvedValue({ id: 'release-1' })
  })

  it('starts an Outcome run for an owned Site using header credentials', async () => {
    const res = await POST(request('http://localhost/api/webhooks/railway', {
      headers: {
        authorization: 'Bearer ff_live_test',
        'x-fixflags-check-url': 'https://my-app.up.railway.app',
      },
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockRequestSiteRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'project-1',
      outcomeIds: ['outcome-1'],
      userId: 'user-1',
      source: 'DEPLOYMENT',
    }))
    expect(json).toMatchObject({ ok: true, runId: 'run-1', auditId: 'audit-1', mode: 'outcomes' })
    expect(mockRequestSiteCareRun).not.toHaveBeenCalled()
  })

  it('rejects an API key in the query string', async () => {
    const res = await POST(request(
      'http://localhost/api/webhooks/railway?apiKey=ff_live_test&url=https://my-app.up.railway.app',
      { headers: { authorization: 'Bearer ff_live_test' } },
    ))

    expect(res.status).toBe(401)
    expect(mockRequestSiteRun).not.toHaveBeenCalled()
  })

  it('returns 400 when the check url is missing', async () => {
    const res = await POST(request('http://localhost/api/webhooks/railway', {
      headers: { authorization: 'Bearer ff_live_test' },
    }))

    expect(res.status).toBe(400)
    expect(mockRequestSiteRun).not.toHaveBeenCalled()
  })

  it('does not start a run for a host the key does not own', async () => {
    mockProjectFindFirst.mockResolvedValue(null)
    const res = await POST(request('http://localhost/api/webhooks/railway', {
      headers: {
        authorization: 'Bearer ff_live_test',
        'x-fixflags-check-url': 'https://other.example',
      },
    }))

    expect(res.status).toBe(404)
    expect(mockRequestSiteRun).not.toHaveBeenCalled()
  })

  it('rejects an invalid API key before enqueueing', async () => {
    mockValidateApiKey.mockResolvedValue(null)
    const res = await POST(request('http://localhost/api/webhooks/railway', {
      headers: {
        authorization: 'Bearer invalid',
        'x-fixflags-check-url': 'https://my-app.up.railway.app',
      },
    }))

    expect(res.status).toBe(401)
    expect(mockRequestSiteRun).not.toHaveBeenCalled()
  })

  it('skips non-success deployment events', async () => {
    const res = await POST(request('http://localhost/api/webhooks/railway', {
      headers: { authorization: 'Bearer ff_live_test' },
      body: JSON.stringify({ type: 'DEPLOY_FAILED', deployment: { status: 'FAILED' } }),
    }))
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.skipped).toBe('ignored_event')
    expect(mockRequestSiteRun).not.toHaveBeenCalled()
  })

  it('requires the webhook secret header when configured', async () => {
    process.env.RAILWAY_WEBHOOK_SECRET = 'railway-secret'
    const res = await POST(request('http://localhost/api/webhooks/railway', {
      headers: {
        authorization: 'Bearer ff_live_test',
        'x-fixflags-check-url': 'https://my-app.up.railway.app',
      },
    }))

    expect(res.status).toBe(401)
    expect(mockRequestSiteRun).not.toHaveBeenCalled()
  })
})
