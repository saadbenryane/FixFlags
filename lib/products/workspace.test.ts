import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  projectFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: {
      findMany: mocks.projectFindMany,
      findFirst: mocks.projectFindFirst,
    },
  },
}))

import { loadProductOverview, loadProductWorkspace } from './workspace'

const now = new Date('2026-08-13T12:00:00.000Z')

beforeEach(() => {
  mocks.projectFindMany.mockReset()
  mocks.projectFindFirst.mockReset()
})

describe('loadProductOverview', () => {
  it('keeps each Review, Attention item, and verification scoped to its Product', async () => {
    mocks.projectFindMany.mockResolvedValue([
      {
        id: 'product-a',
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
        audits: [
          {
            id: 'review-a',
            status: 'COMPLETED',
            score: 82,
            reportCompleteness: 'FULL',
            createdAt: now,
            completedAt: now,
            errorMsg: null,
            parentId: null,
            flags: [{ status: 'OPEN' }],
          },
        ],
        improvements: [
          {
            id: 'improvement-a',
            title: 'Clarify the first action',
            status: 'READY_TO_VERIFY',
            attempts: [],
          },
        ],
      },
      {
        id: 'product-b',
        name: 'Beta',
        url: 'https://beta.example',
        productIntelligence: null,
        watchInterval: null,
        audits: [
          {
            id: 'review-b',
            status: 'COMPLETED',
            score: 44,
            reportCompleteness: 'PARTIAL',
            createdAt: now,
            completedAt: now,
            errorMsg: null,
            parentId: 'review-b-parent',
            flags: [],
          },
        ],
        improvements: [
          {
            id: 'improvement-b',
            title: 'Restore checkout',
            status: 'VERIFIED',
            attempts: [{ outcome: 'IMPROVED', verificationAuditId: 'review-b', createdAt: now }],
          },
        ],
      },
    ])

    const products = await loadProductOverview('user-1')

    expect(products[0]).toMatchObject({
      id: 'product-a',
      attentionCount: 1,
      latestReview: { id: 'review-a', score: 82, unresolvedCount: 1 },
      latestVerification: null,
    })
    expect(products[1]).toMatchObject({
      id: 'product-b',
      attentionCount: 0,
      latestReview: { id: 'review-b', score: 44, isUpdateReview: true },
      latestVerification: {
        outcome: 'IMPROVED',
        improvementTitle: 'Restore checkout',
        verificationReviewId: 'review-b',
      },
    })
    expect(mocks.projectFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: 'user-1' } })
    )
  })
})

describe('loadProductWorkspace', () => {
  it('returns null for a missing or forbidden Product without leaking existence', async () => {
    mocks.projectFindFirst.mockResolvedValue(null)
    await expect(
      loadProductWorkspace('product-other', 'user-1', { signalsEligible: false })
    ).resolves.toBeNull()
    expect(mocks.projectFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'product-other', userId: 'user-1' } })
    )
  })

  it('projects bounded Attention, honest attempts, Review states, memory, and observed Signals', async () => {
    mocks.projectFindFirst.mockResolvedValue({
      id: 'product-1',
      name: 'Product',
      url: 'https://example.com',
      productIntelligence: {
        purpose: 'Help people register',
        firstValueJourney: 'Open signup',
        criticalOutcomes: ['Signup completes'],
        verifiedLearnings: [
          { summary: 'The signup action is clearer', auditId: 'review-2', at: now.toISOString() },
        ],
        source: 'merged',
        updatedAt: now.toISOString(),
      },
      watchInterval: 'WEEKLY',
      watchLastRunAt: now,
      watchLastError: null,
      audits: [
        {
          id: 'review-running',
          status: 'CHECKING',
          score: null,
          reportCompleteness: 'UNKNOWN',
          createdAt: now,
          completedAt: null,
          errorMsg: null,
          parentId: 'review-1',
          flags: [],
        },
        {
          id: 'review-1',
          status: 'COMPLETED',
          score: 70,
          reportCompleteness: 'FULL',
          createdAt: now,
          completedAt: now,
          errorMsg: null,
          parentId: null,
          flags: [{ status: 'OPEN' }, { status: 'FIXED' }],
        },
      ],
      improvements: [
        {
          id: 'improvement-1',
          title: 'Make signup visible',
          judgment: 'The action is difficult to find.',
          recommendedChange: 'Move it into the first view.',
          successCondition: 'The action is visible.',
          priority: 90,
          status: 'READY_TO_VERIFY',
          updatedAt: now,
          occurrences: [{ flag: { evidence: 'CTA below the fold', rubric: 'MESSAGE', severity: 'IMPORTANT' } }],
          attempts: [
            {
              id: 'attempt-1',
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
              remainingRisk: null,
              createdAt: now,
            },
          ],
        },
      ],
      signalKeys: [{ id: 'key-1' }],
      signals: [
        ...Array.from({ length: 3 }, (_, index) => ({
          kind: 'ERROR',
          name: 'checkout_error',
          route: '/checkout',
          sessionHash: `session-${index}`,
          numericValue: null,
          occurredAt: now,
          release: null,
        })),
      ],
    })

    const workspace = await loadProductWorkspace('product-1', 'user-1', {
      signalsEligible: true,
    })

    expect(workspace).toMatchObject({
      product: { id: 'product-1', watching: true, purpose: 'Help people register' },
      attentionCount: 1,
      currentReview: { id: 'review-running', status: 'CHECKING' },
      latestCompletedReview: { id: 'review-1', unresolvedCount: 1 },
      attention: [
        {
          id: 'improvement-1',
          latestAttempt: {
            id: 'attempt-1',
            sourceReviewId: 'review-1',
            outcome: null,
          },
        },
      ],
      integrations: {
        signalsEligible: true,
        activeSignalKeyCount: 1,
      },
    })
    expect(workspace?.integrations.observedContext[0]).toMatchObject({
      truthClass: 'OBSERVED',
      kind: 'ERROR_PATTERN',
    })
  })
})
