import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const createAndEnqueueAudit = vi.hoisted(() => vi.fn())
const checkAnonymousAuditAllowed = vi.hoisted(() => vi.fn())
const trackAnonymousAuditId = vi.hoisted(() => vi.fn())
const normalizeAuditUrl = vi.hoisted(() => vi.fn())
const enforceRateLimit = vi.hoisted(() => vi.fn())
const recordRateLimit = vi.hoisted(() => vi.fn())
const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/create-audit', () => ({ createAndEnqueueAudit }))
vi.mock('@/lib/audit/usage', () => ({
  checkAnonymousAuditAllowed,
  trackAnonymousAuditId,
}))
vi.mock('@/lib/audit/url', () => ({ normalizeAuditUrl }))
vi.mock('@/lib/security/rate-limit', () => ({
  enforceRateLimit,
  recordRateLimit,
}))
vi.mock('@/lib/api/errors', () => ({
  handleRouteError: (e: unknown) =>
    new Response(JSON.stringify({ error: String(e) }), { status: 500 }),
  apiError: (msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status }),
}))

import { GET } from '@/app/api/v1/score/route'

function req(url = 'https://example.com'): NextRequest {
  return {
    url: `http://localhost/api/v1/score?url=${encodeURIComponent(url)}`,
    headers: new Map([['x-forwarded-for', '127.0.0.1']]) as unknown as Headers,
    nextUrl: new URL(`http://localhost/api/v1/score?url=${encodeURIComponent(url)}`),
  } as unknown as NextRequest
}

const mockRubric = (overrides: Record<string, unknown> = {}) => ({
  name: 'message',
  grade: 'C',
  score: 65,
  status: 'COMPLETED',
  flags: [
    {
      id: 'flag-1',
      rubric: 'message',
      severity: 'CRITICAL',
      problem: 'No meta description',
      evidence: '<meta> tag missing',
      fix: 'Add a meta description tag',
      agentPrompt: 'Fix: add a meta description',
      cursorPrompt: null,
      claudePrompt: null,
      windsurfPrompt: null,
      lovablePrompt: null,
      boltPrompt: null,
      whyItMatters: 'Search engines display this in results',
      verificationRule: null,
      pageUrl: null,
    },
  ],
  ...overrides,
})

const completedAudit = (overrides: Record<string, unknown> = {}) => ({
  id: 'audit-1',
  status: 'COMPLETED',
  progress: 1,
  score: 65,
  pageType: 'marketing',
  verdict: 'needs_work',
  errorMsg: null,
  failureCode: null,
  reportCompleteness: 'FULL',
  completedAt: new Date('2026-07-20'),
  url: 'https://example.com',
  rubrics: [mockRubric()],
  ...overrides,
})

describe('GET /api/v1/score', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    enforceRateLimit.mockResolvedValue(undefined)
    recordRateLimit.mockResolvedValue({ exceeded: false, retryAfterSeconds: 0 })
    checkAnonymousAuditAllowed.mockResolvedValue({ allowed: true })
    normalizeAuditUrl.mockReturnValue({ ok: true, url: 'https://example.com' })
    createAndEnqueueAudit.mockResolvedValue({ auditId: 'audit-1' })
    trackAnonymousAuditId.mockResolvedValue(undefined)
  })

  it('returns 400 for missing URL', async () => {
    const r = await GET(req(''))
    expect(r.status).toBe(400)
  })

  it('returns 400 for invalid URL', async () => {
    const r = await GET(req('not-a-url'))
    expect(r.status).toBe(400)
  })

  it('returns 403 when anonymous quota is exhausted', async () => {
    checkAnonymousAuditAllowed.mockResolvedValue({
      allowed: false,
      code: 'UPGRADE_REQUIRED',
      action: 'sign_in',
    })
    const r = await GET(req())
    expect(r.status).toBe(403)
    const body = await r.json()
    expect(body.code).toBe('UPGRADE_REQUIRED')
  })

  it('returns 422 for failed audit', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      completedAudit({ status: 'FAILED', errorMsg: 'Timeout', failureCode: 'CAPTURE_FAILED' })
    )
    const r = await GET(req())
    expect(r.status).toBe(422)
    const body = await r.json()
    expect(body.status).toBe('FAILED')
    expect(body.failureCode).toBe('CAPTURE_FAILED')
  })

  it('returns completed score JSON for successful audit', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(completedAudit())
    const r = await GET(req())
    expect(r.status).toBe(200)
    const body = await r.json()
    expect(body.status).toBe('COMPLETED')
    expect(body.score).toBe(65)
    expect(body.verdict).toBe('needs_work')
    expect(body.totalFlagCount).toBe(1)
    expect(body.rubrics).toHaveLength(1)
    expect(body.rubrics[0].name).toBe('message')
    expect(body.topFlags).toHaveLength(1)
    expect(body.topFlags[0].severity).toBe('CRITICAL')
    expect(body.shareStatus).toBe('fix_before_sharing')
  })

  it('returns good_to_share when no critical flags', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(
      completedAudit({
        rubrics: [
          {
            ...mockRubric(),
            flags: [
              {
                id: 'flag-1',
                rubric: 'experience',
                severity: 'IMPORTANT',
                problem: 'Slow LCP',
                evidence: 'LCP 4.2s',
                fix: 'Optimize images',
                agentPrompt: null,
                cursorPrompt: null,
                claudePrompt: null,
                windsurfPrompt: null,
                lovablePrompt: null,
                boltPrompt: null,
                whyItMatters: null,
                verificationRule: null,
                pageUrl: null,
              },
            ],
          },
        ],
      })
    )
    const r = await GET(req())
    const body = await r.json()
    expect(body.shareStatus).toBe('good_to_share')
  })

  it('applies rate limiting', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(completedAudit())
    await GET(req())
    expect(enforceRateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ scope: 'score-api', limit: 100 })
    )
  })
})
