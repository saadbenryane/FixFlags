import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  journeyFindFirst: vi.fn(),
  executionFindUnique: vi.fn(),
  executionUpsert: vi.fn(),
  runPathProbe: vi.fn(),
  persistJourneyResult: vi.fn(),
  flagUpdateMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    runRequest: {
      findFirst: mocks.runFindFirst,
      updateMany: mocks.runUpdateMany,
    },
    journeyReview: { findFirst: mocks.journeyFindFirst },
    flag: { updateMany: mocks.flagUpdateMany },
    outcomeBindingExecution: {
      findUnique: mocks.executionFindUnique,
      upsert: mocks.executionUpsert,
    },
  },
}))
vi.mock('@/lib/integrity/run-path-probe', () => ({
  runPathProbe: mocks.runPathProbe,
}))
vi.mock('@/lib/audit/journey/run-journey-reviews', () => ({
  persistJourneyResult: mocks.persistJourneyResult,
}))

import { runBoundCheckoutForAudit } from '@/lib/sites/application/checkout-execution'

describe('bound Checkout execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      selections: [{ outcome: {
        id: 'outcome-1',
        kind: 'CHECKOUT',
        bindings: [{
          key: 'checkout-browser-v1',
          mechanism: 'BROWSER_JOURNEY',
          required: true,
          config: { startUrl: 'https://shop.example/products/widget' },
        }],
      } }],
      audit: { url: 'https://shop.example' },
    })
    mocks.journeyFindFirst.mockResolvedValue(null)
    mocks.executionFindUnique.mockResolvedValue(null)
    mocks.executionUpsert.mockResolvedValue({})
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.persistJourneyResult.mockResolvedValue([])
    mocks.flagUpdateMany.mockResolvedValue({ count: 1 })
  })

  it('persists a confirmed purchase failure as one customer-level journey Flag', async () => {
    mocks.runPathProbe.mockResolvedValue({
      health: 'RED',
      reason: 'add_to_cart_noop',
      confirmed: true,
      steps: [
        {
          label: 'failure',
          url: 'https://shop.example/products/widget',
          screenshotUrl: '/proof.png',
        },
      ],
      finalUrl: 'https://shop.example/products/widget',
      failedStep: 'add_to_cart',
    })

    await expect(runBoundCheckoutForAudit('audit-1')).resolves.toBe(true)
    expect(mocks.persistJourneyResult).toHaveBeenCalledWith(
      'audit-1',
      expect.objectContaining({
        journeyType: 'checkout',
        status: 'COMPLETED',
        goalAchieved: false,
        findings: [
          expect.objectContaining({
            checkId: 'journey-checkout-failed-add_to_cart_noop',
            impactTag: 'REVENUE',
            severity: 'CRITICAL',
          }),
        ],
      }),
    )
    expect(mocks.flagUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { fingerprint: 'outcome:checkout' },
      }),
    )
  })

  it('does not submit a protected Signup form', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      selections: [{ outcome: {
        id: 'signup-1',
        kind: 'SIGNUP',
        bindings: [{
          key: 'signup-form-v1',
          mechanism: 'SAFE_FORM',
          required: true,
          config: { startUrl: 'https://shop.example/account/register', safety: 'protected' },
        }],
      } }],
      audit: { url: 'https://shop.example' },
    })

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.runPathProbe).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        disposition: 'BLOCKED',
        reason: 'protected_or_irreversible',
      }),
    }))
  })

  it('persists blocked execution as inconclusive evidence without a Flag', async () => {
    mocks.runPathProbe.mockResolvedValue({
      health: 'UNKNOWN',
      reason: 'bot_wall',
      confirmed: false,
      steps: [],
      finalUrl: 'https://shop.example',
      failedStep: 'landing',
    })
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.persistJourneyResult).toHaveBeenCalledWith(
      'audit-1',
      expect.objectContaining({
        status: 'ABANDONED',
        findings: [],
        blockedReason: 'bot_wall',
      }),
    )
  })
})
