import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteRunRefusal } from '@/lib/sites/application/run-refusal'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  requireSiteAccess: vi.fn(),
  loadSiteBoardFlag: vi.fn(),
  executeSiteCommand: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: mocks.getSession } } }))
vi.mock('next/headers', () => ({ headers: vi.fn().mockResolvedValue(new Headers()) }))
vi.mock('@/lib/sites/request-access', () => ({ requireSiteAccess: mocks.requireSiteAccess }))
vi.mock('@/lib/sites/application/queries', () => ({ loadSiteBoardFlag: mocks.loadSiteBoardFlag }))
vi.mock('@/lib/sites/application/commands', () => ({ executeSiteCommand: mocks.executeSiteCommand }))

import { POST } from '@/app/api/sites/[siteId]/flags/[flagId]/verify/route'

function request(idempotencyKey?: string) {
  return new Request('http://localhost/api/sites/site-1/flags/flag-1/verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}) },
    body: JSON.stringify({ changeSummary: 'Show the confirmation.' }),
  })
}

const context = { params: Promise.resolve({ siteId: 'site-1', flagId: 'flag-1' }) }
const reason = 'This Flag has no comparable source scope to verify.'

describe('POST /api/sites/[siteId]/flags/[flagId]/verify', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'user-1' } })
    mocks.requireSiteAccess.mockResolvedValue({
      ok: true,
      decision: { role: 'owner', site: { siteId: 'site-1', projectId: 'project-1' } },
    })
    mocks.loadSiteBoardFlag.mockResolvedValue({ id: 'flag-1' })
  })

  it('returns the command reason in message when Flag verification cannot start', async () => {
    mocks.executeSiteCommand.mockResolvedValue({ ok: false, error: reason })

    const response = await POST(request(), context)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.message).toBe(reason)
    expect(body.error).toBeUndefined()
  })

  it('returns a busy-Site refusal instead of a generic failure', async () => {
    mocks.executeSiteCommand.mockRejectedValue(new SiteRunRefusal('Another Site run is already in progress', 409))

    const response = await POST(request(), context)
    const body = await response.json()

    expect(response.status).toBe(409)
    expect(body.message).toBe('Another Site run is already in progress')
    expect(body.message).not.toBe('Something went wrong')
  })

  it('accepts a fresh verification and returns its RunRequest identity', async () => {
    mocks.executeSiteCommand.mockResolvedValue({
      ok: true,
      runId: 'run-1',
      verificationAuditId: 'audit-2',
      siteId: 'site-1',
      parentAuditId: 'audit-1',
      flagId: 'flag-1',
      attemptId: 'attempt-1',
      expectedBehavior: 'The confirmation appears.',
    })

    const response = await POST(request('verify-once'), context)
    const body = await response.json()

    expect(response.status).toBe(202)
    expect(body).toMatchObject({ accepted: true, runRequestId: 'run-1', verificationAuditId: 'audit-2' })
    expect(mocks.executeSiteCommand).toHaveBeenCalledWith(expect.objectContaining({
      type: 'VERIFY_FLAG',
      idempotencyKey: 'verify-once',
      source: 'WEB',
    }))
  })
})
