import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  AuditLimitError,
  createAndEnqueueAudit,
} from '@/lib/audit/create-audit'
import { PIPELINE_PROGRESS } from '@/lib/audit/progress'
import {
  decryptScanAccess,
  encryptScanAccess,
} from '@/lib/audit/scan-access'

const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  $executeRaw: vi.fn(),
  audit: {
    create: vi.fn(),
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  project: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  user: {
    findUnique: vi.fn(),
  },
}))

const queueAdd = vi.hoisted(() => vi.fn())
const checkAnonymousAuditAllowed = vi.hoisted(() => vi.fn())
const enforceAnonymousIpSoftCeiling = vi.hoisted(() => vi.fn())
const trackAnonymousAuditId = vi.hoisted(() => vi.fn())
const resolveIncludeAiForNewAudit = vi.hoisted(() => vi.fn())
const wouldBlockNewCheckWithCredits = vi.hoisted(() => vi.fn())
const assertPublicAuditUrl = vi.hoisted(() => vi.fn())
const ensureProductProject = vi.hoisted(() => vi.fn())
const refreshUserUsagePeriod = vi.hoisted(() => vi.fn())
const rollUserUsagePeriod = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/queue/client', () => ({ getAuditQueue: () => ({ add: queueAdd }) }))
vi.mock('@/lib/audit/usage', () => ({
  checkAnonymousAuditAllowed,
  enforceAnonymousIpSoftCeiling,
  trackAnonymousAuditId,
}))
vi.mock('@/lib/audit/ai-report-entitlement', () => ({
  resolveIncludeAiForNewAudit,
}))
vi.mock('@/lib/billing/credits', () => ({ wouldBlockNewCheckWithCredits }))
vi.mock('@/lib/audit/url', () => ({ assertPublicAuditUrl }))
vi.mock('@/lib/audit/ensure-product-project', () => ({ ensureProductProject }))
vi.mock('@/lib/billing/usage-period', () => ({
  refreshUserUsagePeriod,
  rollUserUsagePeriod,
}))

const AUDIT_URL = 'https://example.com/'

function signedInUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    plan: 'FREE',
    role: 'USER',
    auditsLimit: 3,
    auditsUsed: 0,
    subscriptionStatus: 'NONE',
    deepReviewsUsed: 0,
    deepReviewsLimit: 0,
    ...overrides,
  }
}

describe('AuditLimitError contract', () => {
  it('maps codes to default actions and messages', () => {
    expect(new AuditLimitError('AUTH_REQUIRED')).toMatchObject({
      name: 'AuditLimitError',
      code: 'AUTH_REQUIRED',
      action: 'signup',
    })
    expect(new AuditLimitError('UPGRADE_REQUIRED')).toMatchObject({
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
    })
    expect(new AuditLimitError('TOKEN_LIMIT')).toMatchObject({
      code: 'TOKEN_LIMIT',
      action: 'buy_credits',
    })
  })
})

describe('createAndEnqueueAudit', () => {
  beforeEach(() => {
    process.env.TOKEN_ENCRYPTION_KEY = '0'.repeat(64)
    vi.clearAllMocks()

    prismaMock.$transaction.mockImplementation(async (op: (tx: typeof prismaMock) => Promise<{ id: string }>) => {
      return op(prismaMock)
    })
    prismaMock.audit.create.mockResolvedValue({ id: 'audit-1', parentId: null })
    prismaMock.audit.findFirst.mockResolvedValue(null)
    prismaMock.audit.count.mockResolvedValue(0)
    prismaMock.audit.update.mockResolvedValue({})
    prismaMock.user.findUnique.mockResolvedValue(signedInUser())
    queueAdd.mockResolvedValue({ id: 'job-1' })
    checkAnonymousAuditAllowed.mockResolvedValue({ allowed: true })
    resolveIncludeAiForNewAudit.mockResolvedValue(false)
    wouldBlockNewCheckWithCredits.mockResolvedValue({ allowed: true })
    ensureProductProject.mockResolvedValue({ id: 'project-1', productIntelligence: null })
    assertPublicAuditUrl.mockResolvedValue(new URL(AUDIT_URL))
    refreshUserUsagePeriod.mockResolvedValue(signedInUser())
    rollUserUsagePeriod.mockResolvedValue(signedInUser())
  })

  it('creates a reduced single-page teaser for anonymous visitors and tracks the cookie', async () => {
    const result = await createAndEnqueueAudit({ url: AUDIT_URL })

    expect(result).toEqual({
      auditId: 'audit-1',
      status: 'QUEUED',
      reused: false,
      parentId: null,
    })
    expect(prismaMock.$transaction).toHaveBeenCalled()
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        url: AUDIT_URL,
        userId: null,
        projectId: null,
        scanAccessEncrypted: null,
        parentId: null,
        recheckTrigger: null,
        auditMode: 'SINGLE',
        skipUsageCount: false,
        status: 'QUEUED',
        progress: PIPELINE_PROGRESS.QUEUED,
        includeAi: false,
        journeyReviewIncluded: false,
        watchNotificationStatus: 'NOT_APPLICABLE',
        reviewDepth: 1,
      }),
      select: { id: true, parentId: true },
    })
    expect(trackAnonymousAuditId).toHaveBeenCalledWith('audit-1')
    expect(prismaMock.audit.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          url: AUDIT_URL,
          isPublic: true,
        }),
      })
    )
    expect(queueAdd).toHaveBeenCalledWith(
      'audit',
      { auditId: 'audit-1' },
      expect.objectContaining({ jobId: 'audit-1', attempts: 1, delay: 0 })
    )
  })

  it('blocks an anonymous visitor who already used the teaser scan', async () => {
    checkAnonymousAuditAllowed.mockResolvedValueOnce({
      allowed: false,
      code: 'AUTH_REQUIRED',
      action: 'signup',
      error:
        'You’ve used your free scan. Create a free account for fix prompts and more checks.',
    })

    await expect(createAndEnqueueAudit({ url: AUDIT_URL })).rejects.toMatchObject({
      name: 'AuditLimitError',
      code: 'AUTH_REQUIRED',
      action: 'signup',
    })
    expect(prismaMock.audit.create).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('reuses a public scan of the same URL from the last hour without tracking or enqueueing', async () => {
    prismaMock.audit.findFirst.mockResolvedValueOnce({
      id: 'recent-public',
      status: 'COMPLETED',
      parentId: null,
    })

    const result = await createAndEnqueueAudit({ url: AUDIT_URL, clientId: 'ip-1' })

    expect(result).toEqual({
      auditId: 'recent-public',
      status: 'COMPLETED',
      reused: true,
      parentId: null,
    })
    expect(prismaMock.audit.create).not.toHaveBeenCalled()
    expect(trackAnonymousAuditId).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
    expect(checkAnonymousAuditAllowed).not.toHaveBeenCalled()
    expect(enforceAnonymousIpSoftCeiling).not.toHaveBeenCalled()
  })

  it('reuses an in-progress public scan of the same URL from the last hour', async () => {
    prismaMock.audit.findFirst.mockResolvedValueOnce({
      id: 'live-public',
      status: 'CHECKING',
      parentId: null,
    })

    const result = await createAndEnqueueAudit({ url: AUDIT_URL })

    expect(result).toEqual({
      auditId: 'live-public',
      status: 'CHECKING',
      reused: true,
      parentId: null,
    })
    expect(trackAnonymousAuditId).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('enforces the IP soft ceiling for anonymous creates with a client id', async () => {
    await createAndEnqueueAudit({ url: AUDIT_URL, clientId: 'ip-1' })

    expect(enforceAnonymousIpSoftCeiling).toHaveBeenCalledWith('ip-1')
  })

  it('runs the full pipeline for signed-in checks and ensures the product project', async () => {
    resolveIncludeAiForNewAudit.mockResolvedValue(true)
    prismaMock.user.findUnique.mockResolvedValueOnce(
      signedInUser({ plan: 'BUILDER', deepReviewsLimit: 3, deepReviewsUsed: 0 })
    )

    const result = await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })

    expect(result).toEqual({
      auditId: 'audit-1',
      status: 'QUEUED',
      reused: false,
      parentId: null,
    })
    expect(ensureProductProject).toHaveBeenCalledWith('user-1', AUDIT_URL)
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          projectId: 'project-1',
          parentId: null,
          recheckTrigger: null,
          auditMode: 'CRITICAL_PATH',
          skipUsageCount: false,
          status: 'QUEUED',
          includeAi: true,
          journeyReviewIncluded: true,
          watchNotificationStatus: 'NOT_APPLICABLE',
          progress: PIPELINE_PROGRESS.QUEUED,
          scanAccessEncrypted: null,
          url: AUDIT_URL,
        }),
      select: { id: true, parentId: true },
    })
    expect(prismaMock.$executeRaw).toHaveBeenCalledTimes(1)
    expect(trackAnonymousAuditId).not.toHaveBeenCalled()
  })

  it('resumes the active manual Product Review without charging or enqueueing again', async () => {
    prismaMock.audit.findFirst.mockResolvedValueOnce({
      id: 'active-review',
      status: 'CHECKING',
      parentId: 'actual-parent',
    })

    const result = await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })

    expect(result).toEqual({
      auditId: 'active-review',
      status: 'CHECKING',
      reused: true,
      parentId: 'actual-parent',
    })
    expect(prismaMock.audit.findFirst).toHaveBeenCalledWith({
      where: {
        projectId: 'project-1',
        status: { notIn: ['COMPLETED', 'FAILED'] },
        OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' }],
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true, status: true, parentId: true },
    })
    expect(wouldBlockNewCheckWithCredits).not.toHaveBeenCalled()
    expect(prismaMock.audit.create).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('includes path review even when legacy deep-review counters are exhausted', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      signedInUser({ plan: 'BUILDER', deepReviewsUsed: 3, deepReviewsLimit: 3 })
    )
    rollUserUsagePeriod.mockResolvedValue(
      signedInUser({ plan: 'BUILDER', deepReviewsUsed: 3, deepReviewsLimit: 3 })
    )
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })

    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ journeyReviewIncluded: true }),
      select: { id: true, parentId: true },
    })
  })

  it('rejects a signed-in user at their check limit', async () => {
    prismaMock.user.findUnique.mockResolvedValue(signedInUser({ auditsUsed: 3 }))
    prismaMock.audit.count.mockResolvedValueOnce(0)
    wouldBlockNewCheckWithCredits.mockResolvedValueOnce({
      allowed: false,
      code: 'UPGRADE_REQUIRED',
      action: 'upgrade',
      error: 'New URL check limit reached. Upgrade to continue.',
    })

    await expect(createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })).rejects.toMatchObject(
      {
        name: 'AuditLimitError',
        code: 'UPGRADE_REQUIRED',
        action: 'upgrade',
      }
    )
    expect(prismaMock.audit.create).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('treats revoked paid subscriptions as FREE for the hard gate', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      signedInUser({ plan: 'BUILDER', auditsUsed: 25, auditsLimit: 25, subscriptionStatus: 'CANCELED' })
    )
    prismaMock.audit.count.mockResolvedValueOnce(0)

    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })

    expect(wouldBlockNewCheckWithCredits).toHaveBeenCalledWith(
      expect.objectContaining({ plan: 'FREE' }),
      0
    )
  })

  it('keeps non-Watch skipUsageCount retries inside the manual Review lock', async () => {
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1', skipUsageCount: true })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(wouldBlockNewCheckWithCredits).not.toHaveBeenCalled()
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', skipUsageCount: true }),
      select: { id: true, parentId: true },
    })
  })

  it('meters Watch creation inside the usage admission transaction', async () => {
    prismaMock.audit.findUnique
      .mockResolvedValueOnce({
        id: 'parent-1',
        userId: 'user-1',
        status: 'COMPLETED',
      })
      .mockResolvedValueOnce({
        projectId: 'project-1',
        scanAccessEncrypted: null,
      })
    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      parentId: 'parent-1',
      recheckTrigger: 'WATCH',
      skipUsageCount: false,
    })

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ recheckTrigger: 'WATCH', skipUsageCount: false }),
      select: { id: true, parentId: true },
    })
  })

  it('requires sign-in to continue from an existing report', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce({ id: 'parent-1', userId: 'user-1', status: 'COMPLETED' })
    await expect(
      createAndEnqueueAudit({ url: AUDIT_URL, parentId: 'parent-1' })
    ).rejects.toMatchObject({ name: 'ParentAuditError', status: 401 })
    expect(prismaMock.audit.create).not.toHaveBeenCalled()
  })

  it('rejects re-checks on missing, foreign, or incomplete parents', async () => {
    prismaMock.audit.findUnique.mockResolvedValueOnce(null)
    await expect(
      createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1', parentId: 'parent-1' })
    ).rejects.toMatchObject({ name: 'ParentAuditError', status: 404 })

    prismaMock.audit.findUnique.mockResolvedValueOnce({
      id: 'parent-1',
      userId: 'other-user',
      status: 'COMPLETED',
    })
    await expect(
      createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1', parentId: 'parent-1' })
    ).rejects.toMatchObject({ name: 'ParentAuditError', status: 403 })

    prismaMock.audit.findUnique.mockResolvedValueOnce({
      id: 'parent-1',
      userId: 'user-1',
      status: 'CHECKING',
    })
    await expect(
      createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1', parentId: 'parent-1' })
    ).rejects.toMatchObject({ name: 'ParentAuditError', status: 400 })

    expect(prismaMock.audit.create).not.toHaveBeenCalled()
  })

  it('inherits the parent project and runs a full monitoring re-check', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      id: 'parent-1',
      userId: 'user-1',
      status: 'COMPLETED',
      projectId: 'parent-project',
      scanAccessEncrypted: null,
    })

    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      parentId: 'parent-1',
      recheckTrigger: 'WATCH',
    })

    expect(ensureProductProject).not.toHaveBeenCalled()
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        projectId: 'parent-project',
        parentId: 'parent-1',
        recheckTrigger: 'WATCH',
        watchNotificationStatus: 'PENDING',
        monitoringMode: 'FULL',
        auditMode: 'CRITICAL_PATH',
      }),
      select: { id: true, parentId: true },
    })
  })

  it('defaults parented re-checks to a MANUAL trigger', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      id: 'parent-1',
      userId: 'user-1',
      status: 'COMPLETED',
      projectId: 'parent-project',
      scanAccessEncrypted: null,
    })

    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      parentId: 'parent-1',
    })

    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        parentId: 'parent-1',
        recheckTrigger: 'MANUAL',
        watchNotificationStatus: 'NOT_APPLICABLE',
      }),
      select: { id: true, parentId: true },
    })
  })

  it('inherits encrypted scan access from the parent project', async () => {
    const config = { httpBasic: { username: 'preview', password: 'secret' } }
    const encrypted = encryptScanAccess(config)
    prismaMock.audit.findUnique.mockResolvedValue({
      id: 'parent-1',
      userId: 'user-1',
      status: 'COMPLETED',
      projectId: 'parent-project',
      scanAccessEncrypted: encrypted,
    })

    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      parentId: 'parent-1',
    })

    const created = prismaMock.audit.create.mock.calls[0][0].data
    expect(decryptScanAccess(created.scanAccessEncrypted)).toEqual(config)
  })

  it('respects explicit scan access over project inheritance', async () => {
    const inheritedConfig = { httpBasic: { username: 'inherited', password: 'old' } }
    const explicitConfig = { httpBasic: { username: 'explicit', password: 'new' } }
    prismaMock.project.findUnique.mockResolvedValue({
      scanAccessEncrypted: encryptScanAccess(inheritedConfig),
    })

    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      scanAccess: explicitConfig,
    })

    const created = prismaMock.audit.create.mock.calls[0][0].data
    expect(decryptScanAccess(created.scanAccessEncrypted)).toEqual(explicitConfig)
  })

  it('carries attribution fields onto the audit row', async () => {
    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      attribution: {
        normalizedDomain: 'example.com',
        source: 'HOMEPAGE',
        referrer: null,
        utmSource: 'ads',
        utmMedium: 'cpc',
        utmCampaign: null,
        gclid: null,
        fbclid: null,
      },
    })

    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        normalizedDomain: 'example.com',
        source: 'HOMEPAGE',
        referrer: null,
        utmSource: 'ads',
        utmMedium: 'cpc',
        utmCampaign: null,
        gclid: null,
        fbclid: null,
      }),
      select: { id: true, parentId: true },
    })
  })

  it('marks the audit failed and rethrows when the queue add fails', async () => {
    const queueError = new Error('queue down')
    queueAdd.mockRejectedValueOnce(queueError)

    await expect(createAndEnqueueAudit({ url: AUDIT_URL })).rejects.toThrow('queue down')
    expect(prismaMock.audit.update).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        failureCode: 'QUEUE_ENQUEUE_FAILED',
        failureStage: 'queue',
      }),
    })
  })

  it('retries transient serializable conflicts before creating', async () => {
    let calls = 0
    prismaMock.$transaction.mockImplementation(async (op: (tx: typeof prismaMock) => Promise<{ id: string }>) => {
      calls += 1
      if (calls <= 2) {
        throw new Prisma.PrismaClientKnownRequestError('serializable conflict', {
          code: 'P2034',
          clientVersion: '6.0.0',
        })
      }
      return op(prismaMock)
    })

    const result = await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })

    expect(result).toEqual({
      auditId: 'audit-1',
      status: 'QUEUED',
      reused: false,
      parentId: null,
    })
    expect(calls).toBe(3)
  })

  it('does not retry non-conflict transaction errors', async () => {
    prismaMock.$transaction.mockRejectedValueOnce(new Error('db unreachable'))

    await expect(
      createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })
    ).rejects.toThrow('db unreachable')
  })

  it('rejects invalid URLs', async () => {
    assertPublicAuditUrl.mockRejectedValueOnce(
      new Error('Enter a valid URL like https://yoursite.com')
    )

    await expect(createAndEnqueueAudit({ url: 'not-a-url' })).rejects.toThrow(
      'Enter a valid URL'
    )
    expect(prismaMock.audit.create).not.toHaveBeenCalled()
    expect(queueAdd).not.toHaveBeenCalled()
  })

  it('stores reviewDepth 1 for anonymous teasers and Free accounts', async () => {
    await createAndEnqueueAudit({ url: AUDIT_URL })
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewDepth: 1 }),
      select: { id: true, parentId: true },
    })

    prismaMock.audit.create.mockClear()
    prismaMock.user.findUnique.mockResolvedValue(signedInUser({ plan: 'FREE' }))
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewDepth: 1 }),
      select: { id: true, parentId: true },
    })
  })

  it('stores reviewDepth from the owner plan for Pro and Studio', async () => {
    prismaMock.user.findUnique.mockResolvedValue(signedInUser({ plan: 'BUILDER' }))
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewDepth: 2 }),
      select: { id: true, parentId: true },
    })

    prismaMock.audit.create.mockClear()
    prismaMock.user.findUnique.mockResolvedValue(signedInUser({ plan: 'TEAM' }))
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewDepth: 3 }),
      select: { id: true, parentId: true },
    })
  })

  it('copies stored reviewDepth onto update reviews and Watch', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      id: 'parent-1',
      userId: 'user-1',
      status: 'COMPLETED',
      projectId: 'parent-project',
      scanAccessEncrypted: null,
      reviewDepth: 3,
    })
    await createAndEnqueueAudit({
      url: AUDIT_URL,
      userId: 'user-1',
      parentId: 'parent-1',
      recheckTrigger: 'WATCH',
    })
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ reviewDepth: 3, parentId: 'parent-1' }),
      select: { id: true, parentId: true },
    })
  })
})
