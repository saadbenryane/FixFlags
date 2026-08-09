import { describe, it, vi, expect, beforeEach } from 'vitest'
import type { NextRequest } from 'next/server'

const prismaMock = vi.hoisted(() => ({
  audit: { findUnique: vi.fn() },
  flag: { count: vi.fn() },
}))
const resolveSessionUser = vi.hoisted(() => vi.fn())
const resolveAuditAccess = vi.hoisted(() => vi.fn())
const recoverAuditJobOnPoll = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/fetch-audit', () => ({ resolveSessionUser }))
vi.mock('@/lib/audit/access', () => ({ resolveAuditAccess }))
vi.mock('@/lib/audit/recover-audit-job', () => ({ recoverAuditJobOnPoll }))
vi.mock('@/lib/audit/technology-profile', () => ({
  loadTechnologyProfile: vi.fn().mockResolvedValue({
    status: 'not_captured',
    detectorVersion: null,
    detectedAt: null,
    technologies: [],
    insight: null,
  }),
}))
vi.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: vi.fn() }),
}))
vi.mock('@/lib/security/rate-limit', () => ({
  recordRateLimit: vi.fn().mockResolvedValue({ exceeded: false, retryAfterSeconds: 0 }),
  requestClientId: () => 'test-client',
  RateLimitError: class RateLimitError extends Error { retryAfter = 60 },
}))

import { GET } from '@/app/api/reports/[id]/status/route'

function getReq() {
  return {} as unknown as NextRequest
}

const baseAudit = {
  status: 'CHECKING',
  progress: 40,
  score: null,
  pageType: null,
  verdict: null,
  errorMsg: null,
  failureCode: null,
  pipelineVersion: '2.4.0',
  reportCompleteness: 'UNKNOWN',
  startedAt: new Date(),
  completedAt: null,
  updatedAt: new Date(),
  createdAt: new Date(),
  url: 'https://example.com',
  userId: 'u1',
  isPublic: false,
  parentId: null,
  aiReviewAt: null,
  triageAt: null,
  includeAi: true,
  journeyReviewIncluded: false,
  journeyReviewAt: null,
  performanceData: {
    actionTimeline: [{ t: 1000, kind: 'capture', label: 'Opened page' }],
  },
  productContract: {
    purpose: 'Ship cleaner sites',
    firstValueJourney: 'Paste URL',
    criticalOutcomes: ['Clear CTA'],
    source: 'heuristic',
    inferredAt: new Date().toISOString(),
  },
  screenshots: [
    { device: 'DESKTOP', url: '/desktop.png', width: 1440, height: 900 },
    { device: 'MOBILE', url: '/mobile.png', width: 390, height: 844 },
  ],
  rubrics: [],
  flags: [
    {
      id: 'f1',
      severity: 'IMPORTANT',
      problem: 'Weak headline',
      rubric: 'MESSAGE',
      checkId: 'h1-generic',
      source: 'DETERMINISTIC',
    },
  ],
}

describe('GET /api/reports/[id]/status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resolveSessionUser.mockResolvedValue({ user: { id: 'u1' } })
    resolveAuditAccess.mockResolvedValue('owner')
    prismaMock.flag.count.mockResolvedValue(1)
    prismaMock.audit.findUnique.mockResolvedValue(baseAudit)
  })

  it('returns 404 when the report does not exist', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(null)
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'missing' }) })
    expect(res.status).toBe(404)
  })

  it('returns 403 when the viewer cannot access the report', async () => {
    resolveAuditAccess.mockResolvedValue('denied')
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(403)
  })

  it('streams actionTimeline, productContract, and partial flags while checking', async () => {
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'a1' }) })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.status).toBe('CHECKING')
    expect(body.actionTimeline).toEqual([
      { t: 1000, kind: 'capture', label: 'Opened page' },
    ])
    expect(body.productContract?.purpose).toBe('Ship cleaner sites')
    expect(body.technologyProfile).toBeUndefined()
    expect(body.partialFlags).toEqual([
      expect.objectContaining({
        id: 'f1',
        checkId: 'h1-generic',
        source: 'DETERMINISTIC',
      }),
    ])
    expect(body.flagCount).toBe(1)
    expect(body.agentMessages).toEqual([
      expect.objectContaining({ id: 'scan:a1:preparing', source: 'scan', role: 'agent' }),
      expect.objectContaining({ id: 'scan:a1:capturing' }),
      expect.objectContaining({ id: 'scan:a1:checking' }),
      expect.objectContaining({
        id: 'scan:a1:flag:f1',
        evidenceRef: { auditId: 'a1', flagId: 'f1' },
      }),
    ])
    expect(body.agentMessages.some((item: { content: string }) => item.content === 'Opened page')).toBe(false)
  })

  it('keeps Agent updates public-safe while omitting Timeline and private contract data for anonymous reports', async () => {
    resolveAuditAccess.mockResolvedValue('anonymous_teaser')

    const response = await GET(getReq(), { params: Promise.resolve({ id: 'audit-1' }) })
    const body = await response.json()

    expect(body.agentMessages.length).toBeGreaterThan(0)
    expect(body.actionTimeline).toEqual([])
    expect(body.productContract).toBeNull()
    for (const privateField of [
      'userId',
      'parentId',
      'includeAi',
      'aiReviewAt',
      'triageAt',
      'journeyReviewIncluded',
      'journeyReviewAt',
      'errorMsg',
    ]) {
      expect(body).not.toHaveProperty(privateField)
    }
  })

  it('keeps partialFlags on COMPLETED so the progressive hold frame stays populated', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      ...baseAudit,
      status: 'COMPLETED',
      updatedAt: new Date(),
    })
    const res = await GET(getReq(), { params: Promise.resolve({ id: 'a1' }) })
    const body = await res.json()
    expect(body.status).toBe('COMPLETED')
    expect(body.technologyProfile?.status).toBe('not_captured')
    expect(body.partialFlags).toEqual([
      expect.objectContaining({
        id: 'f1',
        checkId: 'h1-generic',
        source: 'DETERMINISTIC',
      }),
    ])
    expect(body.agentMessages.at(-1)).toMatchObject({
      id: 'scan:a1:complete',
      kind: 'completion',
    })
  })
})
