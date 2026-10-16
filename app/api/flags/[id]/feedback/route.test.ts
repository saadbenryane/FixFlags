import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  flagFindUnique: vi.fn(),
  feedbackUpsert: vi.fn(),
  lifecycleUpsert: vi.fn(),
  recordRateLimit: vi.fn(),
  recordOwnerFlagFeedbackDecision: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    flag: { findUnique: mocks.flagFindUnique },
    flagFeedback: { upsert: mocks.feedbackUpsert },
    siteLifecycleEvent: { upsert: mocks.lifecycleUpsert },
  },
}))
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: mocks.getSession } },
}))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit: mocks.recordRateLimit,
  requestClientId: () => 'client-1',
}))
vi.mock('@/lib/live-support/visitor-token', () => ({
  getOrCreateVisitorToken: async () => 'visitor-1',
}))
vi.mock('@/lib/improvements/service', () => ({
  recordOwnerFlagFeedbackDecision: mocks.recordOwnerFlagFeedbackDecision,
}))

import { POST } from './route'

function request(body: unknown): NextRequest {
  return new NextRequest('https://fixflags.com/api/flags/flag-1/feedback', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('Flag feedback lifecycle boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getSession.mockResolvedValue({ user: { id: 'owner-1' } })
    mocks.flagFindUnique.mockResolvedValue({
      id: 'flag-1',
      audit: { userId: 'owner-1', projectId: 'project-1' },
    })
    mocks.feedbackUpsert.mockResolvedValue({ id: 'feedback-1', vote: -1 })
    mocks.lifecycleUpsert.mockResolvedValue({})
    mocks.recordRateLimit.mockResolvedValue(undefined)
    mocks.recordOwnerFlagFeedbackDecision.mockResolvedValue({ action: 'REJECT' })
  })

  it('sends owner dismissals through the Improvement service', async () => {
    const response = await POST(
      request({ vote: -1, dismiss: true, reason: 'low_priority', comment: 'Later' }),
      { params: Promise.resolve({ id: 'flag-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.lifecycleUpsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ name: 'flag_feedback_recorded', userId: 'owner-1', projectId: 'project-1', properties: { vote: -1, reason: 'LOW_IMPACT', owner: true } }) }))
    expect(JSON.stringify(mocks.lifecycleUpsert.mock.calls)).not.toContain('Later')
    expect(mocks.recordOwnerFlagFeedbackDecision).toHaveBeenCalledWith({
      flagId: 'flag-1',
      userId: 'owner-1',
      reason: 'low_priority',
      note: 'Later',
    })
  })

  it('keeps visitor thumbs feedback separate from owner lifecycle state', async () => {
    mocks.getSession.mockResolvedValue(null)

    const response = await POST(
      request({ vote: -1, dismiss: true, reason: 'incorrect' }),
      { params: Promise.resolve({ id: 'flag-1' }) }
    )

    expect(response.status).toBe(200)
    expect(mocks.feedbackUpsert).toHaveBeenCalled()
    expect(mocks.recordOwnerFlagFeedbackDecision).not.toHaveBeenCalled()
    expect(mocks.lifecycleUpsert).not.toHaveBeenCalled()
  })
})
