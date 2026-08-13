import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  audit: { create: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  project: { findUnique: vi.fn(), upsert: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const queueAdd = vi.hoisted(() => vi.fn())
const checkAnonymousAuditAllowed = vi.hoisted(() => vi.fn())
const enforceAnonymousIpSoftCeiling = vi.hoisted(() => vi.fn())
const trackAnonymousAuditId = vi.hoisted(() => vi.fn())
const resolveIncludeAiForNewAudit = vi.hoisted(() => vi.fn())
const wouldBlockDeepReview = vi.hoisted(() => vi.fn())
const wouldBlockNewCheckWithCredits = vi.hoisted(() => vi.fn())
const assertPublicAuditUrl = vi.hoisted(() => vi.fn())
const ensureProductProject = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => ({ add: queueAdd }) }))
vi.mock('@/lib/audit/usage', () => ({ checkAnonymousAuditAllowed, enforceAnonymousIpSoftCeiling, trackAnonymousAuditId }))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({ resolveIncludeAiForNewAudit }))
vi.mock('@/lib/billing/deep-review-limit', () => ({ wouldBlockDeepReview }))
vi.mock('@/lib/billing/credits', () => ({ wouldBlockNewCheckWithCredits }))
vi.mock('@/lib/audit/url', () => ({ assertPublicAuditUrl }))
vi.mock('@/lib/audit/ensure-product-project', () => ({ ensureProductProject }))

const AUDIT_URL = 'https://example.com/'

describe('debug', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64)
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (op: (tx: typeof prismaMock) => Promise<{ id: string }>) =>
      op(prismaMock)
    )
    prismaMock.audit.create.mockResolvedValue({ id: 'audit-1' })
    prismaMock.user.findUnique.mockResolvedValue({ id: 'user-1', plan: 'FREE', role: 'USER', auditsLimit: 3, auditsUsed: 0, subscriptionStatus: 'NONE', deepReviewsUsed: 0, deepReviewsLimit: 0 })
    queueAdd.mockResolvedValue({ id: 'job-1' })
    checkAnonymousAuditAllowed.mockResolvedValue({ allowed: true })
    resolveIncludeAiForNewAudit.mockResolvedValue(true)
    wouldBlockDeepReview.mockResolvedValue(false)
    wouldBlockNewCheckWithCredits.mockResolvedValue({ allowed: true })
    ensureProductProject.mockResolvedValue({ id: 'project-1', productIntelligence: null })
    assertPublicAuditUrl.mockResolvedValue(new URL(AUDIT_URL))
  })

  it('debug journey', async () => {
    prismaMock.user.findUnique.mockImplementation((args: { where: { id: string } }) => {
      console.log('findUnique called with', JSON.stringify(args))
      return Promise.resolve({ id: 'user-1', plan: 'FREE', role: 'USER', auditsLimit: 3, auditsUsed: 0, subscriptionStatus: 'NONE', deepReviewsUsed: 0, deepReviewsLimit: 0 })
    })
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })
    expect(wouldBlockDeepReview).toHaveBeenCalled()
  })
})
