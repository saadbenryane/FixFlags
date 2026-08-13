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
  audit: {
    create: vi.fn(),
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
const wouldBlockDeepReview = vi.hoisted(() => vi.fn())
const wouldBlockNewCheckWithCredits = vi.hoisted(() => vi.fn())
const assertPublicAuditUrl = vi.hoisted(() => vi.fn())
const ensureProductProject = vi.hoisted(() => vi.fn())

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
vi.mock('@/lib/billing/deep-review-limit', () => ({ wouldBlockDeepReview }))
vi.mock('@/lib/billing/credits', () => ({ wouldBlockNewCheckWithCredits }))
vi.mock('@/lib/audit/url', () => ({ assertPublicAuditUrl }))
vi.mock('@/lib/audit/ensure-product-project', () => ({ ensureProductProject }))

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
    prismaMock.audit.create.mockResolvedValue({ id: 'audit-1' })
    prismaMock.audit.update.mockResolvedValue({})
    prismaMock.user.findUnique.mockResolvedValue(signedInUser())
    queueAdd.mockResolvedValue({ id: 'job-1' })
    checkAnonymousAuditAllowed.mockResolvedValue({ allowed: true })
    resolveIncludeAiForNewAudit.mockResolvedValue(false)
    wouldBlockDeepReview.mockResolvedValue(false)
    wouldBlockNewCheckWithCredits.mockResolvedValue({ allowed: true })
    ensureProductProject.mockResolvedValue({ id: 'project-1', productIntelligence: null })
    assertPublicAuditUrl.mockResolvedValue(new URL(AUDIT_URL))
  })

  it('creates a reduced single-page teaser for anonymous visitors and tracks the cookie', async () => {
    const result = await createAndEnqueueAudit({ url: AUDIT_URL })

    expect(result).toEqual({ auditId: 'audit-1', status: 'QUEUED' })
    expect(prismaMock.$transaction).not.toHaveBeenCalled()
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
      }),
      select: { id: true },
    })
    expect(trackAnonymousAuditId).toHaveBeenCalledWith('audit-1')
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

    expect(result).toEqual({ auditId: 'audit-1', status: 'QUEUED' })
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
          journeyReviewIncluded: false,
          watchNotificationStatus: 'NOT_APPLICABLE',
          progress: PIPELINE_PROGRESS.QUEUED,
          scanAccessEncrypted: null,
          url: AUDIT_URL,
        }),
        select: { id: true },
      })
    expect(trackAnonymousAuditId).not.toHaveBeenCalled()
  })

  it('drops journey review for a user whose deep-review quota is exhausted', async () => {
    prismaMock.user.findUnique.mockResolvedValue(
      signedInUser({ plan: 'BUILDER', deepReviewsUsed: 3, deepReviewsLimit: 3 })
    )
    wouldBlockDeepReview.mockResolvedValue(true)

    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1' })

    expect(wouldBlockDeepReview).toHaveBeenCalledWith(
      expect.objectContaining({ deepReviewsUsed: 3, deepReviewsLimit: 3 })
    )
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ journeyReviewIncluded: false }),
      select: { id: true },
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

  it('skips the limit transaction entirely for skipUsageCount re-checks', async () => {
    await createAndEnqueueAudit({ url: AUDIT_URL, userId: 'user-1', skipUsageCount: true })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.audit.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1', skipUsageCount: true }),
      select: { id: true },
    })
  })

  it('requires sign-in to continue from an existing report', async () => {
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
      select: { id: true },
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
      select: { id: true },
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
      select: { id: true },
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

    expect(result).toEqual({ auditId: 'audit-1', status: 'QUEUED' })
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
})
