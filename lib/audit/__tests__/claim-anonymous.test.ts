import { describe, it, vi, expect, beforeEach } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  audit: {
    findMany: vi.fn(),
    updateMany: vi.fn(),
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

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('next/headers', () => ({ cookies: async () => cookieStore }))
vi.mock('@/lib/audit/usage', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/audit/usage')>()
  return {
    ...actual,
    incrementUsageOnCompleteForAudit,
    readAnonAuditIds: (raw: string | undefined) =>
      raw ? raw.split(',').filter(Boolean) : [],
  }
})
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ remainingAiReportCredits }))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ enqueueAiReview }))
vi.mock('@/lib/auth/permissions', () => ({ hasUnlimitedScans }))

import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { ANON_AUDIT_IDS_COOKIE } from '@/lib/audit/usage'

describe('claimAnonymousAudits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    cookieStore.get.mockReturnValue({ value: 'teaser-1' })
    prismaMock.audit.findMany.mockResolvedValue([
      {
        id: 'teaser-1',
        status: 'COMPLETED',
        aiReviewAt: null,
        skipUsageCount: false,
        usageCountedAt: null,
      },
    ])
    prismaMock.audit.updateMany.mockResolvedValue({ count: 1 })
    prismaMock.audit.update.mockResolvedValue({})
    prismaMock.user.findUnique.mockResolvedValue({
      id: 'u1',
      role: 'user',
      auditsUsed: 0,
      auditsLimit: 3,
    })
    remainingAiReportCredits.mockResolvedValue(3)
    enqueueAiReview.mockResolvedValue(undefined)
    hasUnlimitedScans.mockReturnValue(false)
  })

  it('returns 0 and skips work when there is no anon cookie', async () => {
    cookieStore.get.mockReturnValue(undefined)
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(0)
    expect(prismaMock.audit.findMany).not.toHaveBeenCalled()
  })

  it('assigns ownership, counts usage, and enqueues prescription before includeAi', async () => {
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(1)
    expect(prismaMock.audit.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['teaser-1'] } },
      data: { userId: 'u1' },
    })
    expect(incrementUsageOnCompleteForAudit).toHaveBeenCalledWith('teaser-1', 'u1')
    expect(enqueueAiReview).toHaveBeenCalledWith('teaser-1')
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'teaser-1' },
      data: { includeAi: true },
    })
    const enqueueOrder = enqueueAiReview.mock.invocationCallOrder[0]
    const includeAiOrder = prismaMock.audit.update.mock.invocationCallOrder[0]
    expect(enqueueOrder).toBeLessThan(includeAiOrder)
    expect(cookieStore.delete).toHaveBeenCalledWith(ANON_AUDIT_IDS_COOKIE)
  })

  it('does not set includeAi when enqueue fails', async () => {
    enqueueAiReview.mockRejectedValue(new Error('queue down'))
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(1)
    expect(prismaMock.audit.update).not.toHaveBeenCalled()
  })
})
