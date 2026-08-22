import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}))
const getSession = vi.hoisted(() => vi.fn())
const recheckAndCompare = vi.hoisted(() => vi.fn())
const recordRateLimit = vi.hoisted(() => vi.fn())
const getWorkerQueueEstimate = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession } } }))
vi.mock('next/headers', () => ({ headers: async () => new Headers() }))
vi.mock('@/lib/audit/task-contracts', () => ({ recheckAndCompare }))
vi.mock('@/lib/queue/estimate', () => ({
  computeEnqueueDelay: vi.fn((_: number, queue: { delayedJobs: number }) => ({
    delayMs: queue.delayedJobs,
    queued: false,
    queueReason: undefined,
    queue: { active: queue.delayedJobs, waiting: 0, delayed: 0 } as never,
  })),
  getWorkerQueueEstimate: () => getWorkerQueueEstimate(),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit,
  RateLimitError: class RateLimitError extends Error {
    retryAfter: number
    constructor(retryAfter: number) {
      super('Too many requests')
      this.retryAfter = retryAfter
    }
  },
}))

import { POST } from '@/app/api/reports/[id]/re-check/route'

function postReq() {
  return {} as unknown as NextRequest
}

describe('POST /api/reports/[id]/re-check', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getSession.mockResolvedValue({ user: { id: 'u1' } })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', plan: 'FREE' })
    recordRateLimit.mockResolvedValue({ exceeded: false, retryAfterSeconds: 0, currentCount: 1 })
    getWorkerQueueEstimate.mockResolvedValue({
      activeJobs: 0,
      waitingJobs: 0,
      delayedJobs: 0,
      active: 0,
      waiting: 0,
      delayed: 0,
    })
    recheckAndCompare.mockResolvedValue({
      parentReportId: 'parent-1',
      reportId: 'child-1',
      reportUrl: 'https://fixflags.com/report/child-1',
      status: 'QUEUED',
      reused: false,
      diff: null,
    })
  })

  it('returns 401 when there is no session', async () => {
    getSession.mockResolvedValue(null)
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'parent-1' }) })
    expect(res.status).toBe(401)
    expect(recheckAndCompare).not.toHaveBeenCalled()
  })

  it('returns 404 when the session user is missing from the database', async () => {
    prismaMock.user.findUnique.mockResolvedValue(null)
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'parent-1' }) })
    expect(res.status).toBe(404)
  })

  it('starts a re-check and forwards quota enforcement to task layer', async () => {
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'parent-1' }) })
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body).toEqual({
      reportId: 'child-1',
      reportUrl: 'https://fixflags.com/report/child-1',
      status: 'QUEUED',
      reused: false,
      parentReportId: 'parent-1',
    })
    expect(recheckAndCompare).toHaveBeenCalledWith({
      parentReportId: 'parent-1',
      user: expect.objectContaining({ id: 'u1' }),
      delayMs: 0,
    })
  })

  it('returns the active Review without claiming a new resource', async () => {
    recheckAndCompare.mockResolvedValueOnce({
      parentReportId: null,
      reportId: 'active-review',
      reportUrl: 'https://fixflags.com/report/active-review',
      status: 'CHECKING',
      reused: true,
      diff: null,
    })

    const res = await POST(postReq(), { params: Promise.resolve({ id: 'parent-1' }) })

    expect(res.status).toBe(200)
    await expect(res.json()).resolves.toEqual({
      reportId: 'active-review',
      reportUrl: 'https://fixflags.com/report/active-review',
      status: 'CHECKING',
      reused: true,
      parentReportId: null,
    })
  })

  it('forwards ownership / incomplete parent errors from startMonitoringAudit', async () => {
    recheckAndCompare.mockRejectedValue(
      Object.assign(new Error('You can only re-check your own reports'), {
        status: 403,
        code: 'FORBIDDEN',
      })
    )
    const res = await POST(postReq(), { params: Promise.resolve({ id: 'parent-1' }) })
    expect(res.status).toBe(403)
  })
})
