import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectFindFirst: vi.fn(),
  auditFindFirst: vi.fn(),
  auditFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
  occurrenceFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: mocks.projectFindMany,
      findFirst: mocks.projectFindFirst,
    },
    audit: {
      findFirst: mocks.auditFindFirst,
      findMany: mocks.auditFindMany,
    },
    improvementAttempt: { findMany: mocks.attemptFindMany },
    improvementOccurrence: { findMany: mocks.occurrenceFindMany },
  },
}))

import {
  loadProductOverview,
  loadProductWorkspace,
  loadVerificationReceiptsForReview,
  parseProductHistoryCursor,
  PRODUCT_HISTORY_PAGE_SIZE,
} from './workspace'

const now = new Date('2026-08-20T12:00:00.000Z')

function review(overrides: Record<string, unknown> = {}) {
  return {
    id: 'review-1',
    status: 'COMPLETED',
    score: 70,
    reportCompleteness: 'FULL',
    createdAt: now,
    completedAt: now,
    errorMsg: null,
    parentId: null,
    recheckTrigger: null,
    watchRegressionCount: null,
    watchNotificationStatus: 'NOT_APPLICABLE',
    watchNotificationAttempts: 0,
    watchNotificationLastError: null,
    flags: [{ status: 'OPEN' }, { status: 'FIXED' }],
    ...overrides,
  }
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'product-1',
    name: 'Product',
    url: 'https://example.com',
    productIntelligence: {
      purpose: 'Help people register',
      firstValueJourney: 'Open signup',
      criticalOutcomes: ['Signup completes'],
      source: 'merged',
      updatedAt: now.toISOString(),
    },
    watchInterval: 'WEEKLY',
    watchLastRunAt: now,
    watchNextRunAt: now,
    watchLastAttemptAt: now,
    watchConsecutiveFailures: 0,
    watchLastError: null,
    improvements: [],
    signalKeys: [],
    signals: [],
    ...overrides,
  }
}

function attempt(overrides: Record<string, unknown> = {}) {
  return {
    id: 'attempt-1',
    improvementId: 'improvement-1',
    sourceAuditId: 'review-1',
    builder: 'web',
    changeSummary: 'Moved the CTA',
    deploymentReference: 'deploy-1',
    verificationAuditId: null,
    outcome: null,
    testedCondition: null,
    comparable: null,
    verificationCoverage: null,
    verificationReason: null,
    evidenceReference: null,
    remainingRisk: null,
    createdAt: now,
    improvement: { title: 'Make signup visible' },
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.auditFindFirst.mockResolvedValue(null)
  mocks.auditFindMany.mockResolvedValue([])
  mocks.attemptFindMany.mockResolvedValue([])
  mocks.occurrenceFindMany.mockResolvedValue([])
})

describe('parseProductHistoryCursor', () => {
  it('accepts only a valid date plus a typed event ID', () => {
    expect(
      parseProductHistoryCursor(`${now.toISOString()}|review:review-1`),
    ).toEqual({
      at: now.toISOString(),
      id: 'review:review-1',
    })
    expect(
      parseProductHistoryCursor('not-a-date|review:review-1'),
    ).toBeNull()
    expect(parseProductHistoryCursor(`${now.toISOString()}|review-1`)).toBeNull()
    expect(parseProductHistoryCursor(undefined)).toBeNull()
  })
})

describe('loadVerificationReceiptsForReview', () => {
  it('loads owner-bounded receipts in stable order with their source Flag', async () => {
    mocks.attemptFindMany.mockResolvedValue([
      attempt({
        verificationAuditId: 'review-2',
        outcome: 'IMPROVED',
        verificationReason: 'The independent check passed.',
      }),
    ])
    mocks.occurrenceFindMany.mockResolvedValue([
      {
        improvementId: 'improvement-1',
        auditId: 'review-1',
        flagId: 'flag-1',
      },
    ])

    const receipts = await loadVerificationReceiptsForReview('review-2', 'user-1')

    expect(mocks.attemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          verificationAuditId: 'review-2',
          improvement: { project: { userId: 'user-1' } },
        },
      }),
    )
    expect(receipts).toEqual([
      expect.objectContaining({
        id: 'attempt-1',
        sourceReviewId: 'review-1',
        sourceFlagId: 'flag-1',
        verificationReviewId: 'review-2',
        outcome: 'IMPROVED',
      }),
    ])
  })

  it('does not query occurrences when the Review has no receipts', async () => {
    mocks.attemptFindMany.mockResolvedValue([])

    await expect(
      loadVerificationReceiptsForReview('review-2', 'user-1'),
    ).resolves.toEqual([])
    expect(mocks.occurrenceFindMany).not.toHaveBeenCalled()
  })
})

describe('loadProductOverview', () => {
  it('projects only the latest manual Review and removes dead verification data', async () => {
    mocks.projectFindMany.mockResolvedValue([
      {
        id: 'product-a',
        userId: 'user-1',
        name: 'Alpha',
        url: 'https://alpha.example',
        productIntelligence: {
          purpose: 'Help Alpha customers',
          firstValueJourney: 'Start',
          criticalOutcomes: [],
          source: 'user',
          updatedAt: now.toISOString(),
        },
        watchInterval: 'WEEKLY',
        audits: [review({ id: 'review-a' })],
        improvements: [
          {
            id: 'improvement-a',
            title: 'Clarify the first action',
            status: 'READY_TO_VERIFY',
            occurrences: [{ flag: { severity: 'IMPORTANT' } }],
          },
        ],
      },
    ])

    const products = await loadProductOverview('user-1')

    expect(products).toEqual([
      expect.objectContaining({
        id: 'product-a',
        attentionCount: 1,
        topAttention: {
          id: 'improvement-a',
          title: 'Clarify the first action',
          status: 'READY_TO_VERIFY',
          severity: 'IMPORTANT',
        },
        latestManualReview: expect.objectContaining({
          id: 'review-a',
          kind: 'PRODUCT_REVIEW',
          score: 70,
          unresolvedCount: 1,
        }),
      }),
    ])
    expect(products[0]).not.toHaveProperty('latestVerification')
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        select: expect.objectContaining({
          audits: expect.objectContaining({
            where: {
              OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' }],
            },
            take: 1,
          }),
          improvements: expect.objectContaining({
            where: {
              status: {
                in: expect.arrayContaining(['PROPOSED', 'READY_TO_VERIFY']),
              },
            },
          }),
        }),
      }),
    )
  })
})

describe('loadProductWorkspace', () => {
  it('returns null for a missing or forbidden Product without loading any Review state', async () => {
    mocks.projectFindFirst.mockResolvedValue(null)

    await expect(
      loadProductWorkspace('product-other', 'user-1', {
        signalsEligible: false,
      }),
    ).resolves.toBeNull()
    expect(mocks.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'product-other', userId: 'user-1' },
      }),
    )
    expect(mocks.auditFindFirst).not.toHaveBeenCalled()
  })

  it('loads manual and Watch states independently and resolves exact attempt provenance', async () => {
    const activeManual = review({
      id: 'review-running',
      status: 'JUDGING',
      score: null,
      reportCompleteness: 'UNKNOWN',
      completedAt: null,
      parentId: 'review-1',
      recheckTrigger: 'MANUAL',
      flags: [],
    })
    const completedManual = review()
    const watch = review({
      id: 'review-watch-running',
      status: 'CHECKING',
      score: null,
      reportCompleteness: 'UNKNOWN',
      completedAt: null,
      parentId: 'review-1',
      recheckTrigger: 'WATCH',
      watchNotificationStatus: 'PENDING',
      flags: [],
    })
    mocks.projectFindFirst.mockResolvedValue(
      product({
        improvements: [
          {
            id: 'improvement-1',
            title: 'Make signup visible',
            judgment: 'The action is difficult to find.',
            recommendedChange: 'Move it into the first view.',
            successCondition: 'The action is visible.',
            priority: 90,
            status: 'READY_TO_VERIFY',
            occurrences: [
              {
                auditId: 'review-2',
                flagId: 'flag-2',
                flag: {
                  evidence: 'CTA below the fold',
                  rubric: 'EXPERIENCE',
                  severity: 'IMPORTANT',
                },
              },
            ],
          },
        ],
        signalKeys: [
          {
            id: 'key-1',
            name: 'Browser snippet',
            prefix: 'ff_sig_test',
            lastFour: 'last',
            allowedOrigin: 'https://example.com',
            lastUsedAt: now,
            createdAt: now,
          },
        ],
        signals: Array.from({ length: 3 }, (_, index) => ({
          kind: 'ERROR',
          name: 'checkout_error',
          route: '/checkout',
          sessionHash: `session-${index}`,
          numericValue: null,
          occurredAt: now,
          release: null,
        })),
      }),
    )
    mocks.auditFindFirst
      .mockResolvedValueOnce(activeManual)
      .mockResolvedValueOnce(activeManual)
      .mockResolvedValueOnce(completedManual)
      .mockResolvedValueOnce(watch)
    mocks.auditFindMany.mockResolvedValue([
      watch,
      activeManual,
      completedManual,
    ])
    mocks.attemptFindMany.mockResolvedValue([attempt()])
    mocks.occurrenceFindMany.mockResolvedValue([
      {
        improvementId: 'improvement-1',
        auditId: 'review-1',
        flagId: 'flag-1',
      },
    ])

    const workspace = await loadProductWorkspace('product-1', 'user-1', {
      signalsEligible: true,
    })

    expect(workspace).toMatchObject({
      product: {
        id: 'product-1',
        watching: true,
        purpose: 'Help people register',
      },
      attentionCount: 1,
      activeManualReview: { id: 'review-running', kind: 'UPDATE_REVIEW' },
      latestManualReview: { id: 'review-running', kind: 'UPDATE_REVIEW' },
      latestCompletedManualReview: { id: 'review-1', kind: 'PRODUCT_REVIEW' },
      latestWatchReview: {
        id: 'review-watch-running',
        kind: 'WATCH',
        notificationStatus: 'PENDING',
      },
      attention: [
        {
          id: 'improvement-1',
          sourceReviewId: 'review-2',
          sourceFlagId: 'flag-2',
        },
      ],
      integrations: {
        signalsEligible: true,
        signalKeys: [
          expect.objectContaining({
            id: 'key-1',
            lastUsedAt: now.toISOString(),
          }),
        ],
      },
    })
    const attemptEvent = workspace?.history.events.find(
      (event) => event.kind === 'attempt',
    )
    expect(attemptEvent).toMatchObject({
      kind: 'attempt',
      attempt: { sourceReviewId: 'review-1', sourceFlagId: 'flag-1' },
    })
    expect(
      workspace?.history.events.find(
        (event) => event.id === 'review:review-watch-running',
      ),
    ).toMatchObject({
      kind: 'review',
      review: { kind: 'WATCH' },
    })
    expect(workspace?.integrations.observedContext[0]).toMatchObject({
      truthClass: 'OBSERVED',
      kind: 'ERROR_PATTERN',
    })
    expect(mocks.auditFindFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'product-1',
          status: { notIn: ['COMPLETED', 'FAILED'] },
          OR: [{ recheckTrigger: null }, { recheckTrigger: 'MANUAL' }],
        }),
      }),
    )
    expect(mocks.occurrenceFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          improvement: { projectId: 'product-1' },
          auditId: { in: ['review-1'] },
        },
      }),
    )
    expect(mocks.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          improvements: expect.objectContaining({
            select: expect.objectContaining({
              occurrences: expect.objectContaining({ take: 1 }),
            }),
          }),
        }),
      }),
    )
  })

  it('prefers persisted beforeFlagId over occurrence inference', async () => {
    mocks.projectFindFirst.mockResolvedValue(product())
    mocks.attemptFindMany.mockResolvedValue([
      attempt({
        evidenceReference: {
          beforeAuditId: 'review-1',
          beforeFlagId: 'persisted-flag',
        },
      }),
    ])
    mocks.occurrenceFindMany.mockResolvedValue([
      {
        improvementId: 'improvement-1',
        auditId: 'review-1',
        flagId: 'inferred-flag',
      },
    ])

    const workspace = await loadProductWorkspace('product-1', 'user-1', {
      signalsEligible: false,
    })

    expect(workspace?.history.events[0]).toMatchObject({
      kind: 'attempt',
      attempt: { sourceFlagId: 'persisted-flag' },
    })
  })

  it('returns at most 20 unified events with an exact date-and-ID cursor', async () => {
    mocks.projectFindFirst.mockResolvedValue(
      product({
        productIntelligence: {
          purpose: 'Help people register',
          firstValueJourney: 'Open signup',
          criticalOutcomes: [],
          verifiedLearnings: [
            {
              summary: 'Signup is clearer',
              auditId: 'review-learning',
              at: '2026-08-20T12:30:00.000Z',
            },
          ],
          source: 'merged',
          updatedAt: now.toISOString(),
        },
      }),
    )
    mocks.auditFindMany.mockResolvedValue(
      Array.from({ length: 15 }, (_, index) =>
        review({
          id: `review-${index.toString().padStart(2, '0')}`,
          createdAt: new Date(Date.UTC(2026, 7, 20, 12, 29 - index)),
        }),
      ),
    )
    mocks.attemptFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) =>
        attempt({
          id: `attempt-${index.toString().padStart(2, '0')}`,
          createdAt: new Date(Date.UTC(2026, 7, 20, 12, 14 - index)),
        }),
      ),
    )

    const workspace = await loadProductWorkspace('product-1', 'user-1', {
      signalsEligible: false,
    })

    expect(workspace?.history.events).toHaveLength(PRODUCT_HISTORY_PAGE_SIZE)
    expect(workspace?.history.events[0]).toMatchObject({ kind: 'learning' })
    expect(workspace?.history.nextCursor).toEqual({
      at: workspace?.history.events.at(-1)?.at,
      id: workspace?.history.events.at(-1)?.id,
    })
  })

  it('applies the server cursor to each database history source', async () => {
    mocks.projectFindFirst.mockResolvedValue(product())
    const cursor = parseProductHistoryCursor(
      `${now.toISOString()}|review:review-10`,
    )

    await loadProductWorkspace('product-1', 'user-1', {
      signalsEligible: false,
      historyCursor: cursor,
    })

    expect(mocks.auditFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'product-1',
          OR: [
            { createdAt: { lt: now } },
            { createdAt: now, id: { lt: 'review-10' } },
          ],
        }),
      }),
    )
    expect(mocks.attemptFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          improvement: { projectId: 'product-1' },
          createdAt: { lte: now },
        }),
      }),
    )
  })
})
