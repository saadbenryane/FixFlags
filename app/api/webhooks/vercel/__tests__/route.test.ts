import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHmac } from 'node:crypto'
import { NextRequest } from 'next/server'

const mockValidateApiKey = vi.hoisted(() => vi.fn())
const mockCheckAndPlan = vi.hoisted(() => vi.fn())

vi.mock('@/lib/mcp/tools', () => ({
  validateApiKey: mockValidateApiKey,
}))

vi.mock('@/lib/audit/task-contracts', () => ({
  checkAndPlan: mockCheckAndPlan,
}))

import { POST } from '@/app/api/webhooks/vercel/route'

const secret = 'vercel-test-secret'

function sign(body: string): string {
  const digest = createHmac('sha1', secret).update(body).digest('hex')
  return `sha1=${digest}`
}

function deploymentBody(url = 'https://preview.example.com') {
  return JSON.stringify({
    type: 'deployment.succeeded',
    payload: {
      deployment: { url },
      target: 'preview',
    },
  })
}

describe('POST /api/webhooks/vercel', () => {
  const originalSecret = process.env.VERCEL_WEBHOOK_SECRET

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.VERCEL_WEBHOOK_SECRET = secret
    mockValidateApiKey.mockResolvedValue({ id: 'user-1' })
    mockCheckAndPlan.mockResolvedValue({
      reportId: 'audit-1',
      reportUrl: 'https://fixflags.com/report/audit-1',
      status: 'QUEUED',
    })
  })

  afterEach(() => {
    process.env.VERCEL_WEBHOOK_SECRET = originalSecret
  })

  it('returns 503 when webhook secret is not configured', async () => {
    delete process.env.VERCEL_WEBHOOK_SECRET
    const body = deploymentBody()
    const req = new NextRequest('http://localhost/api/webhooks/vercel?apiKey=ff_live_test', {
      method: 'POST',
      body,
      headers: { 'x-vercel-signature': sign(body) },
    })

    const res = await POST(req)

    expect(res.status).toBe(503)
  })

  it('returns 401 for invalid signature', async () => {
    const body = deploymentBody()
    const req = new NextRequest('http://localhost/api/webhooks/vercel?apiKey=ff_live_test', {
      method: 'POST',
      body,
      headers: { 'x-vercel-signature': 'sha1=bad' },
    })

    const res = await POST(req)

    expect(res.status).toBe(401)
    expect(mockCheckAndPlan).not.toHaveBeenCalled()
  })

  it('accepts api key from query string and enqueues a check', async () => {
    const body = deploymentBody('https://my-app.vercel.app')
    const req = new NextRequest('http://localhost/api/webhooks/vercel?apiKey=ff_live_test', {
      method: 'POST',
      body,
      headers: { 'x-vercel-signature': sign(body) },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(mockValidateApiKey).toHaveBeenCalledWith('ff_live_test')
    expect(mockCheckAndPlan).toHaveBeenCalledWith({
      url: 'https://my-app.vercel.app',
      userId: 'user-1',
      auditMode: 'CRITICAL_PATH',
      waitForCompletion: false,
    })
    expect(json.reportId).toBe('audit-1')
  })

  it('skips non-deployment events', async () => {
    const body = JSON.stringify({ type: 'project.created' })
    const req = new NextRequest('http://localhost/api/webhooks/vercel?apiKey=ff_live_test', {
      method: 'POST',
      body,
      headers: { 'x-vercel-signature': sign(body) },
    })

    const res = await POST(req)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.skipped).toBe('ignored_event')
    expect(mockCheckAndPlan).not.toHaveBeenCalled()
  })
})
