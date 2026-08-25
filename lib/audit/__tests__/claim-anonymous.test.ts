import { describe, it, vi, expect, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  audit: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  user: { findUnique: vi.fn() },
}))
const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  delete: vi.fn(),
}))
const incrementUsageOnCompleteForAudit = vi.hoisted(() => vi.fn())
const remainingAiReportCredits = vi.hoisted(() => vi.fn())
const enqueueAiReview = vi.hoisted(() => vi.fn())
const hasUnlimitedScans = vi.hoisted(() => vi.fn())
const assertCanCreateProduct = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }))
vi.mock('@/lib/audit/usage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/usage')>()
  return {
    ...actual,
    incrementUsageOnCompleteForAudit,
  }
})
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ remainingAiReportCredits }))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ enqueueAiReview }))
vi.mock('@/lib/auth/permissions', () => ({ hasUnlimitedScans }))
vi.mock('@/lib/billing/product-capacity', () => ({ assertCanCreateProduct }))
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { ANON_AUDIT_IDS_COOKIE } from '@/lib/audit/usage'
import { createAnonymousClaim } from '@/lib/security/anonymous-claim'

process.env.BETTER_AUTH_SECRET = 'test-anonymous-claim-secret-at-least-32-chars'

describe('claimAnonymousAudits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (operation) => operation(prismaMock))
    cookieStore.get.mockReturnValue({ value: createAnonymousClaim('teaser-1') })
    prismaMock.audit.findMany.mockResolvedValue([
      {
        id: 'teaser-1',
        status: 'COMPLETED',
        aiReviewAt: null,
        skipUsageCount: false,
        usageCountedAt: null,
        url: 'https://example.com',
        projectId: null,
        productContract: null,
      },
    ])
    prismaMock.audit.update.mockResolvedValue({})
    prismaMock.audit.findUnique.mockResolvedValue({
      status: 'CHECKING',
      aiReviewAt: null,
    })
    prismaMock.project.upsert.mockResolvedValue({
      id: 'project-1',
      productIntelligence: null,
    })
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 3,
    })
    remainingAiReportCredits.mockResolvedValue(3)
    enqueueAiReview.mockResolvedValue(undefined)
    hasUnlimitedScans.mockReturnValue(false)
    assertCanCreateProduct.mockResolvedValue(undefined)
  })

  it('returns 0 and skips work when there is no anon cookie', async () => {
    cookieStore.get.mockReturnValue(undefined)
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(0)
    expect(prismaMock.audit.findMany).not.toHaveBeenCalled()
  })

  it('does not claim a known audit id from an unsigned or tampered cookie', async () => {
    cookieStore.get.mockReturnValue({ value: '["teaser-1"]' })
    expect(await claimAnonymousAudits('u1')).toBe(0)
    expect(prismaMock.audit.findMany).not.toHaveBeenCalled()
  })

  it('assigns ownership, counts usage, and enqueues prescription before includeAi', async () => {
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(1)
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'teaser-1' },
      data: { userId: 'u1', projectId: 'project-1' },
    })
    expect(incrementUsageOnCompleteForAudit).toHaveBeenCalledWith('teaser-1', 'u1')
    expect(enqueueAiReview).toHaveBeenCalledWith('teaser-1')
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'teaser-1' },
      data: { includeAi: true },
    })
    const enqueueOrder = enqueueAiReview.mock.invocationCallOrder[0]
    const includeAiOrder = prismaMock.audit.update.mock.invocationCallOrder.at(-1)!
    expect(enqueueOrder).toBeLessThan(includeAiOrder)
    expect(cookieStore.delete).toHaveBeenCalledWith(ANON_AUDIT_IDS_COOKIE)
  })

  it('keeps the claim retryable when enqueue fails', async () => {
    enqueueAiReview.mockRejectedValue(new Error('queue down'))
    await expect(claimAnonymousAudits('u1')).rejects.toThrow('queue down')
    expect(cookieStore.delete).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).not.toHaveBeenCalledWith({
      where: { id: 'teaser-1' },
      data: { includeAi: true },
    })
  })

  it('persists prompt eligibility when an audit is claimed in flight', async () => {
    prismaMock.audit.findMany.mockResolvedValue([
      {
        id: 'teaser-1',
        status: 'CHECKING',
        aiReviewAt: null,
        skipUsageCount: false,
        usageCountedAt: null,
        url: 'https://example.com',
        projectId: null,
        productContract: null,
      },
    ])

    await claimAnonymousAudits('u1')

    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'teaser-1' },
      data: { includeAi: true },
    })
    expect(enqueueAiReview).not.toHaveBeenCalled()
    expect(cookieStore.delete).toHaveBeenCalledWith(ANON_AUDIT_IDS_COOKIE)
  })

  it('enqueues once when an in-flight claim completes during handoff', async () => {
    prismaMock.audit.findMany.mockResolvedValue([
      {
        id: 'teaser-1',
        status: 'FINALIZING',
        aiReviewAt: null,
        skipUsageCount: false,
        usageCountedAt: null,
        url: 'https://example.com',
        projectId: null,
        productContract: null,
      },
    ])
    prismaMock.audit.findUnique.mockResolvedValue({
      status: 'COMPLETED',
      aiReviewAt: null,
    })

    await claimAnonymousAudits('u1')

    expect(enqueueAiReview).toHaveBeenCalledTimes(1)
    expect(enqueueAiReview).toHaveBeenCalledWith('teaser-1')
  })
})
