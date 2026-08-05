import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const getSession = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())
const requestClientId = vi.hoisted(() => vi.fn(() => 'client-1'))
const upsertPaidPlanWaitlistEntry = vi.hoisted(() => vi.fn())
const changeEmail = vi.hoisted(() => vi.fn())

vi.mock('@/lib/auth', () => ({ auth: { api: { getSession, changeEmail } } }))
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
    upsertPaidPlanWaitlistEntry.mockResolvedValue({
      id: 'entry-1',
      discountTier: 1,
    })
  })

  it('requires a signed-in session', async () => {
    getSession.mockResolvedValue(null)
    const response = await POST(postReq({ plan: 'BUILDER' }))
    expect(response.status).toBe(401)
    expect(upsertPaidPlanWaitlistEntry).not.toHaveBeenCalled()
    expect(changeEmail).not.toHaveBeenCalled()
  })

  it('records the captured email, plan, source, and campaign', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'account@example.com', name: 'Builder' },
    })
    const response = await POST(
      postReq({
        plan: 'BUILDER',
        source: 'waitlist',
        campaign: 'ph_2026',
        email: 'captured@example.com',
      })
    )
    expect(response.status).toBe(200)
    expect(upsertPaidPlanWaitlistEntry).toHaveBeenCalledWith({
      userId: 'user-1',
      plan: 'BUILDER',
      email: 'captured@example.com',
      source: 'waitlist',
      campaign: 'ph_2026',
    })
  })

  it('falls back to the account email when no email is sent', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'account@example.com', name: 'Builder' },
    })
    const response = await POST(postReq({ plan: 'TEAM', source: 'pricing' }))
    expect(response.status).toBe(200)
    expect(upsertPaidPlanWaitlistEntry).toHaveBeenCalledWith({
      userId: 'user-1',
      plan: 'TEAM',
      email: 'account@example.com',
      source: 'pricing',
      campaign: undefined,
    })
  })

  it('attaches a differing captured email to the account (SSO private relay case)', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'xyz@privaterelay.appleid.com', name: 'Builder' },
    })
    const response = await POST(
      postReq({ plan: 'BUILDER', email: 'real@example.com' })
    )
    expect(response.status).toBe(200)
    expect(changeEmail).toHaveBeenCalledWith({
      body: { newEmail: 'real@example.com', callbackURL: '/waitlist' },
      headers: expect.any(Headers),
    })
  })

  it('does not attach when the captured email equals the account email', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'same@example.com', name: 'Builder' },
    })
    const response = await POST(postReq({ plan: 'BUILDER', email: 'same@example.com' }))
    expect(response.status).toBe(200)
    expect(changeEmail).not.toHaveBeenCalled()
  })

  it('never fails the join when email attachment errors (no existence leak)', async () => {
    getSession.mockResolvedValue({
      user: { id: 'user-1', email: 'account@example.com', name: 'Builder' },
    })
    changeEmail.mockRejectedValue(new Error('email already in use'))
    const response = await POST(postReq({ plan: 'BUILDER', email: 'other@example.com' }))
    expect(response.status).toBe(200)
    expect(upsertPaidPlanWaitlistEntry).toHaveBeenCalledTimes(1)
  })

  it('rejects invalid plans', async () => {
    getSession.mockResolvedValue({ user: { id: 'user-1', email: 'builder@example.com' } })
    const response = await POST(postReq({ plan: 'FREE' }))
    expect(response.status).toBe(400)
  })
})
