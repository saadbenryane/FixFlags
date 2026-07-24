import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

const mockValidateApiKey = vi.hoisted(() => vi.fn())
const mockCheckAndPlan = vi.hoisted(() => vi.fn())

vi.mock('@/lib/mcp/tools', () => ({
  validateApiKey: mockValidateApiKey,
}))

vi.mock('@/lib/audit/task-contracts', () => ({
  checkAndPlan: mockCheckAndPlan,
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

describe('POST /api/webhooks/railway', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.RAILWAY_WEBHOOK_SECRET
    mockValidateApiKey.mockResolvedValue({
      user: { id: 'user-1' },
      apiKey: { id: 'api-key-1', client: 'railway' },
    })
    mockCheckAndPlan.mockResolvedValue({
      reportId: 'audit-1',
      reportUrl: 'https://fixflags.com/report/audit-1',
      status: 'QUEUED',
    })
  })

  it('enqueues a check on deploy success with url and apiKey query params', async () => {
    const req = new NextRequest(
      'http://localhost/api/webhooks/railway?apiKey=ff_live_test&url=https://my-app.up.railway.app',
      {
        method: 'POST',
        body: JSON.stringify(successPayload()),
      }
    )

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockCheckAndPlan).toHaveBeenCalledWith({
      url: 'https://my-app.up.railway.app',
      userId: 'user-1',
      auditMode: 'CRITICAL_PATH',
      waitForCompletion: false,
    })
    expect(json.reportId).toBe('audit-1')
  })

  it('returns 400 when check url is missing', async () => {
    const req = new NextRequest('http://localhost/api/webhooks/railway?apiKey=ff_live_test', {
      method: 'POST',
      body: JSON.stringify(successPayload()),
    })

    const res = await POST(req)

    expect(res.status).toBe(400)
    expect(mockCheckAndPlan).not.toHaveBeenCalled()
  })

  it('rejects an invalid API key before enqueueing a check', async () => {
    mockValidateApiKey.mockResolvedValue(null)
    const req = new NextRequest(
      'http://localhost/api/webhooks/railway?apiKey=invalid&url=https://my-app.up.railway.app',
      {
        method: 'POST',
        body: JSON.stringify(successPayload()),
      }
    )

    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(mockCheckAndPlan).not.toHaveBeenCalled()
  })

  it('skips non-success deployment events', async () => {
    const req = new NextRequest(
      'http://localhost/api/webhooks/railway?apiKey=ff_live_test&url=https://my-app.up.railway.app',
      {
        method: 'POST',
        body: JSON.stringify({ type: 'DEPLOY_FAILED', deployment: { status: 'FAILED' } }),
      }
    )

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.skipped).toBe('ignored_event')
    expect(mockCheckAndPlan).not.toHaveBeenCalled()
  })

  it('requires webhook secret when configured', async () => {
    process.env.RAILWAY_WEBHOOK_SECRET = 'railway-secret'
    const req = new NextRequest(
      'http://localhost/api/webhooks/railway?apiKey=ff_live_test&url=https://my-app.up.railway.app',
      {
        method: 'POST',
        body: JSON.stringify(successPayload()),
      }
    )

    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(mockCheckAndPlan).not.toHaveBeenCalled()
  })
})
