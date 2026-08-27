import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import {
  isTeaserAuditRow,
  resolveAuditPipelineMode,
} from '@/lib/audit/pipeline/mode'
import { createAndEnqueueAudit } from '@/lib/audit/create-audit'

/**
 * Option A coverage: anonymous teaser scans select the reduced pipeline
 * (single page, no flow walk, no slow replay) while signed-in checks and
 * re-checks keep the full pipeline. Also proves the existing anonymous gates
 * (one teaser via cookie + IP soft ceiling, claim, includeAi) still run.
 */

const { prismaMock, queueAddMock, gates } = vi.hoisted(() => ({
  prismaMock: {
    audit: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(), count: vi.fn() },
    user: { findUnique: vi.fn() },
    project: { findUnique: vi.fn() },
    $executeRaw: vi.fn(),
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock)
      if (Array.isArray(arg)) return Promise.all(arg)
      return arg
    }),
  },
  queueAddMock: vi.fn(async () => ({ id: 'job-1' })),
  gates: {
    checkAnonymousAuditAllowed: vi.fn(async () => ({ allowed: true })),
    enforceAnonymousIpSoftCeiling: vi.fn(async () => undefined),
    trackAnonymousAuditId: vi.fn(async () => undefined),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/queue/client', () => ({
  getAuditQueue: vi.fn(() => ({ add: queueAddMock })),
}))
vi.mock('@/lib/auth/permissions', () => ({
  getEffectiveScanLimit: vi.fn(() => 5),
  hasUnlimitedScans: vi.fn(() => true),
  isAdminUser: vi.fn(() => false),
  isUnlimitedScanLimit: vi.fn(() => false),
}))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({
  resolveIncludeAiForNewAudit: vi.fn(async () => false),
}))
vi.mock('@/lib/auth/entitlements', () => ({
  hasRevokedSubscriptionStatus: vi.fn(() => false),
}))
vi.mock('@/lib/billing/deep-review-limit', () => ({
  wouldBlockDeepReview: vi.fn(() => false),
}))
vi.mock('@/lib/billing/credits', () => ({
  wouldBlockNewCheckWithCredits: vi.fn(async () => ({ allowed: true })),
}))
vi.mock('@/lib/audit/url', () => ({
  assertPublicAuditUrl: vi.fn(async (url: string) => new URL(url)),
}))
vi.mock('@/lib/audit/scan-access', () => ({
  encryptScanAccess: vi.fn((value: unknown) => JSON.stringify(value)),
  decryptScanAccess: vi.fn((value: string) => JSON.parse(value)),
}))
vi.mock('@/lib/audit/usage', () => gates)
vi.mock('@/lib/audit/ensure-product-project', () => ({
  ensureProductProject: vi.fn(async () => ({ id: 'project-1' })),
}))

function createdAuditData(): Record<string, unknown> {
  const call = prismaMock.audit.create.mock.calls.at(-1)?.[0] as {
    data: Record<string, unknown>
  }
  return call?.data ?? {}
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.audit.create.mockResolvedValue({ id: 'audit-new', parentId: null })
  prismaMock.audit.findFirst.mockResolvedValue(null)
  prismaMock.audit.count.mockResolvedValue(0)
    prismaMock.user.findUnique.mockResolvedValue({
    id: 'user-1',
    plan: 'FREE',
    role: 'USER',
    subscriptionStatus: 'ACTIVE',
    deepReviewsUsed: 0,
    deepReviewsLimit: 1,
  })
  prismaMock.project.findUnique.mockResolvedValue({ scanAccessEncrypted: null })
})

describe('isTeaserAuditRow', () => {
  it('classifies an anonymous first scan (no user, no parent) as a teaser', () => {
    expect(isTeaserAuditRow({ userId: null, parentId: null })).toBe(true)
  })

  it('never classifies signed-in or re-check audits as teasers', () => {
    expect(isTeaserAuditRow({ userId: 'user-1', parentId: null })).toBe(false)
    expect(isTeaserAuditRow({ userId: null, parentId: 'parent-1' })).toBe(false)
    expect(isTeaserAuditRow({ userId: 'user-1', parentId: 'parent-1' })).toBe(false)
  })
})

describe('resolveAuditPipelineMode', () => {
  it('resolves TEASER for an anonymous new-URL audit', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ userId: null, parentId: null })
    await expect(resolveAuditPipelineMode('audit-1')).resolves.toBe('TEASER')
  })

  it('resolves FULL for signed-in audits', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ userId: 'user-1', parentId: null })
    await expect(resolveAuditPipelineMode('audit-1')).resolves.toBe('FULL')
  })

  it('resolves FULL for re-checks (parented audits)', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({ userId: 'user-1', parentId: 'parent-1' })
    await expect(resolveAuditPipelineMode('audit-1')).resolves.toBe('FULL')
  })

  it('resolves FULL when the audit row is missing', async () => {
    prismaMock.audit.findUnique.mockResolvedValue(null)
    await expect(resolveAuditPipelineMode('audit-missing')).resolves.toBe('FULL')
  })
})

describe('createAndEnqueueAudit anonymous teaser stage subset', () => {
  it('creates an anonymous teaser as a SINGLE-page audit and keeps the anon gates', async () => {
    await createAndEnqueueAudit({ url: 'https://example.com', clientId: 'ip-1' })

    const data = createdAuditData()
    expect(data.auditMode).toBe('SINGLE')
    expect(data.reviewDepth).toBe(1)
    expect(data.userId).toBeNull()
    expect(data.parentId).toBeNull()
    // Gates still enforced on the anonymous path.
    expect(gates.checkAnonymousAuditAllowed).toHaveBeenCalledTimes(1)
    expect(gates.enforceAnonymousIpSoftCeiling).toHaveBeenCalledWith('ip-1')
    expect(gates.trackAnonymousAuditId).toHaveBeenCalledWith('audit-new')
    expect(queueAddMock).toHaveBeenCalledTimes(1)
  })

  it('forces SINGLE even when an anonymous caller requests full capture', async () => {
    await createAndEnqueueAudit({
      url: 'https://example.com',
      auditMode: 'CRITICAL_PATH',
    })
    expect(createdAuditData().auditMode).toBe('SINGLE')
  })
})

describe('createAndEnqueueAudit full pipeline for signed-in paths', () => {
  it('stores full capture and plan reviewDepth for a signed-in new-URL audit', async () => {
    await createAndEnqueueAudit({ url: 'https://example.com', userId: 'user-1' })

    const data = createdAuditData()
    expect(data.auditMode).toBe('CRITICAL_PATH')
    expect(data.reviewDepth).toBe(1)
    expect(data.userId).toBe('user-1')
    expect(data.parentId).toBeNull()
    // The anonymous teaser gates must not run for signed-in creates.
    expect(gates.checkAnonymousAuditAllowed).not.toHaveBeenCalled()
    expect(gates.enforceAnonymousIpSoftCeiling).not.toHaveBeenCalled()
    expect(gates.trackAnonymousAuditId).not.toHaveBeenCalled()
  })

  it('keeps full capture and copies stored reviewDepth for re-checks', async () => {
    prismaMock.audit.findUnique
      .mockResolvedValueOnce({ id: 'parent-1', userId: 'user-1', status: 'COMPLETED', reviewDepth: 2 })
      .mockResolvedValueOnce({ reviewDepth: 2 })
      .mockResolvedValueOnce({ projectId: 'project-1', scanAccessEncrypted: null })

    await createAndEnqueueAudit({
      url: 'https://example.com',
      userId: 'user-1',
      parentId: 'parent-1',
      monitoringMode: 'FULL',
      recheckTrigger: 'MANUAL',
    })

    const data = createdAuditData()
    expect(data.auditMode).toBe('CRITICAL_PATH')
    expect(data.reviewDepth).toBe(2)
    expect(data.parentId).toBe('parent-1')
    expect(data.monitoringMode).toBe('FULL')
  })
})

describe('includeAi entitlement flow stays intact for anon creates', () => {
  it('resolves includeAi through the entitlement module for every create', async () => {
    const { resolveIncludeAiForNewAudit } = await import('@/lib/audit/ai-report-entitlement')
    await createAndEnqueueAudit({ url: 'https://example.com' })
    expect(resolveIncludeAiForNewAudit as Mock).toHaveBeenCalledWith(null)
  })
})
