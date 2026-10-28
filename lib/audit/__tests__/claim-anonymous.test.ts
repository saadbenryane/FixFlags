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
  flag: { findMany: vi.fn() },
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
const monitoring = vi.hoisted(() => ({ ensure: vi.fn(), claim: vi.fn(), migrate: vi.fn() }))
const recordSiteLifecycleEvent = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent }))
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
vi.mock('@/lib/sites/application/default-monitoring', () => ({ ensureDefaultMonitoring: monitoring.ensure }))
vi.mock('@/lib/sites/ensure-site', () => ({ claimProvisionalSitesForProject: monitoring.claim, migrateProvisionalSiteDataToProject: monitoring.migrate }))
import { claimAnonymousAudits } from '@/lib/audit/claim-anonymous'
import { ANON_AUDIT_IDS_COOKIE } from '@/lib/audit/usage'
import { createAnonymousClaim, createAnonymousClaims } from '@/lib/security/anonymous-claim'

process.env.BETTER_AUTH_SECRET = 'test-anonymous-claim-secret-at-least-32-chars'

function claimableAudit(id = 'teaser-1') {
  return { id, userId: null, status: 'COMPLETED', aiReviewAt: null, skipUsageCount: false,
    triageAt: new Date(),
    usageCountedAt: null, url: 'https://example.com', projectId: null, productContract: null }
}

describe('claimAnonymousAudits', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    recordSiteLifecycleEvent.mockReset().mockResolvedValue({})
    monitoring.migrate.mockReset()
    prismaMock.$transaction.mockImplementation(async (operation) => operation(prismaMock))
    cookieStore.get.mockReturnValue({ value: createAnonymousClaim('teaser-1') })
    prismaMock.project.findUnique.mockReset().mockResolvedValue({ id: 'project-1', userId: 'u1', productIntelligence: null, deletedAt: null })
    prismaMock.audit.findMany.mockResolvedValue([claimableAudit()])
    prismaMock.audit.update.mockResolvedValue({})
    prismaMock.flag.findMany.mockResolvedValue([])
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

  it('refuses a claim retry whose linked Site is now owned by another account', async () => {
    prismaMock.audit.findMany.mockResolvedValue([{ ...claimableAudit(), userId: 'u1', projectId: 'foreign-project' }])
    prismaMock.project.findUnique.mockResolvedValue({ id: 'foreign-project', userId: 'u2', productIntelligence: null, deletedAt: new Date() })
    await expect(claimAnonymousAudits('u1')).rejects.toThrow('Site is no longer owned by this account')
    expect(prismaMock.project.update).not.toHaveBeenCalled()
    expect(prismaMock.audit.update).not.toHaveBeenCalled()
    expect(monitoring.claim).not.toHaveBeenCalled()
    expect(monitoring.ensure).not.toHaveBeenCalled()
    expect(cookieStore.delete).not.toHaveBeenCalled()
  })

  it('returns 0 and skips work when there is no anon cookie', async () => {
    cookieStore.get.mockReturnValue(undefined)
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(0)
    expect(prismaMock.audit.findMany).not.toHaveBeenCalled()
  })

  it('initializes monitoring after preserving provisional identity and its binding history', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'project-1', userId: 'u1', productIntelligence: null })
    await claimAnonymousAudits('u1')
    expect(monitoring.ensure).toHaveBeenCalledWith(prismaMock, 'project-1', 'u1')
    expect(monitoring.claim).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1' }), prismaMock)
    expect(monitoring.migrate).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'project-1' }), prismaMock)
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(monitoring.migrate.mock.invocationCallOrder[0]).toBeLessThan(monitoring.ensure.mock.invocationCallOrder[0])
  })

  it('retains the claim proof and skips follow-up work when identity migration fails', async () => {
    monitoring.migrate.mockRejectedValueOnce(new Error('migration interrupted'))
    await expect(claimAnonymousAudits('u1')).rejects.toThrow('migration interrupted')
    expect(monitoring.ensure).not.toHaveBeenCalled()
    expect(enqueueAiReview).not.toHaveBeenCalled()
    expect(incrementUsageOnCompleteForAudit).not.toHaveBeenCalled()
    expect(cookieStore.delete).not.toHaveBeenCalled()
    expect(recordSiteLifecycleEvent).not.toHaveBeenCalled()
  })

  it('does not claim a known audit id from an unsigned or tampered cookie', async () => {
    cookieStore.get.mockReturnValue({ value: '["teaser-1"]' })
    expect(await claimAnonymousAudits('u1')).toBe(0)
    expect(prismaMock.audit.findMany).not.toHaveBeenCalled()
  })

  it('assigns ownership, counts usage and admits authorized prescription durably', async () => {
    const claimed = await claimAnonymousAudits('u1')
    expect(claimed).toBe(1)
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'teaser-1' },
      data: { userId: 'u1', projectId: 'project-1' },
    })
    expect(incrementUsageOnCompleteForAudit).toHaveBeenCalledWith('teaser-1', 'u1')
    expect(enqueueAiReview).toHaveBeenCalledWith('teaser-1')
    expect(cookieStore.delete).toHaveBeenCalledWith(ANON_AUDIT_IDS_COOKIE)
    expect(recordSiteLifecycleEvent).toHaveBeenCalledWith({ name: 'analysis_claimed',
      idempotencyKey: 'analysis_claimed:teaser-1', userId: 'u1', projectId: 'project-1' })
    expect(monitoring.ensure.mock.invocationCallOrder[0]).toBeLessThan(recordSiteLifecycleEvent.mock.invocationCallOrder[0])
  })

  it('preserves a successful claim and follow-up when optional measurement storage fails', async () => {
    recordSiteLifecycleEvent.mockRejectedValue(new Error('telemetry unavailable'))
    expect(await claimAnonymousAudits('u1')).toBe(1)
    expect(prismaMock.audit.update).toHaveBeenCalledWith({ where: { id: 'teaser-1' }, data: { userId: 'u1', projectId: 'project-1' } })
    expect(enqueueAiReview).toHaveBeenCalledWith('teaser-1')
    expect(cookieStore.delete).toHaveBeenCalledWith(ANON_AUDIT_IDS_COOKIE)
  })

  it('records every claimed analysis separately when a single Site receives multiple analyses', async () => {
    cookieStore.get.mockReturnValue({ value: createAnonymousClaims(['teaser-1', 'teaser-2']) })
    prismaMock.audit.findMany.mockResolvedValue([claimableAudit('teaser-1'), claimableAudit('teaser-2')])
    expect(await claimAnonymousAudits('u1')).toBe(2)
    const receipts = recordSiteLifecycleEvent.mock.calls.map(([input]) => input).filter((input) => input.name === 'analysis_claimed')
    expect(receipts).toEqual([
      { name: 'analysis_claimed', idempotencyKey: 'analysis_claimed:teaser-1', userId: 'u1', projectId: 'project-1' },
      { name: 'analysis_claimed', idempotencyKey: 'analysis_claimed:teaser-2', userId: 'u1', projectId: 'project-1' },
    ])
  })

  it('never creates a new transition receipt when retrying an already-owned historical claim', async () => {
    prismaMock.audit.findMany.mockResolvedValue([{ ...claimableAudit(), userId: 'u1', projectId: 'project-1' }])
    expect(await claimAnonymousAudits('u1')).toBe(1)
    expect(recordSiteLifecycleEvent.mock.calls.map(([input]) => input.name)).not.toContain('analysis_claimed')
  })

  it('keeps the claim retryable when durable admission fails', async () => {
    enqueueAiReview.mockRejectedValue(new Error('admission unavailable'))
    await expect(claimAnonymousAudits('u1')).rejects.toThrow('admission unavailable')
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
        userId: null,
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

  it.each(['COMPLETED', 'FINALIZING'])('claims %s partial evidence without scheduling an impossible prescription', async status => {
    prismaMock.audit.findMany.mockResolvedValue([{ ...claimableAudit(), status, triageAt: null }])
    prismaMock.audit.findUnique.mockResolvedValue({ status: 'COMPLETED', aiReviewAt: null, triageAt: null })
    expect(await claimAnonymousAudits('u1')).toBe(1)
    expect(prismaMock.audit.update).toHaveBeenCalledWith({ where: { id: 'teaser-1' }, data: { includeAi: true } })
    expect(enqueueAiReview).not.toHaveBeenCalled()
    expect(cookieStore.delete).toHaveBeenCalledWith(ANON_AUDIT_IDS_COOKIE)
    expect(monitoring.ensure).toHaveBeenCalled()
  })

  it('enqueues once when an in-flight claim completes during handoff', async () => {
    prismaMock.audit.findMany.mockResolvedValue([
      {
        id: 'teaser-1',
        userId: null,
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
      triageAt: new Date(),
    })

    await claimAnonymousAudits('u1')

    expect(enqueueAiReview).toHaveBeenCalledTimes(1)
    expect(enqueueAiReview).toHaveBeenCalledWith('teaser-1')
  })
})
