import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const getSession = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())
const requestClientId = vi.hoisted(() => vi.fn(() => 'client-1'))
const upsertPaidPlanWaitlistEntry = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit,
  requestClientId,
}))
vi.mock('@/lib/billing/waitlist', () => ({ upsertPaidPlanWaitlistEntry }))
vi.mock('@/lib/email/client', () => ({ resend: null }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))

import { POST } from '../route'

function postReq(body: unknown) {
  return {
    headers: new Headers(),
    json: async () => body,
  } as unknown as NextRequest
}

describe('POST /api/stripe/waitlist', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue({ exceeded: false })
    upsertPaidPlanWaitlistEntry.mockResolvedValue(undefined)
  })

  it('requires a signed-in session', async () => {
    getSession.mockResolvedValue(null)
    const response = await POST(postReq({ plan: 'BUILDER' }))
    expect(response.status).toBe(401)
    expect(upsertPaidPlanWaitlistEntry).not.toHaveBeenCalled()
  })

  it('upserts the waitlist entry for the signed-in user email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'builder@example.com', name: 'Builder' },
    })
    const response = await POST(
      postReq({ plan: 'BUILDER', source: 'pricing', email: 'ignored@example.com' })
    )
    expect(response.status).toBe(200)
    expect(upsertPaidPlanWaitlistEntry).toHaveBeenCalledWith({
      userId: 'user-1',
      plan: 'BUILDER',
      source: 'pricing',
      campaign: undefined,
    })
  })

  it('rejects invalid plans', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1', email: 'builder@example.com' } })
    const response = await POST(postReq({ plan: 'FREE' }))
    expect(response.status).toBe(400)
  })
})
