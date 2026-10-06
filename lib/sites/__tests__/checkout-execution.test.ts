import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  journeyFindFirst: vi.fn(),
  executionFindUnique: vi.fn(),
  executionUpsert: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCreateMany: vi.fn(),
  attemptUpdateMany: vi.fn(),
  runGoalProbe: vi.fn(),
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
    outcomeBindingAttempt: {
      findFirst: mocks.attemptFindFirst,
      createMany: mocks.attemptCreateMany,
      updateMany: mocks.attemptUpdateMany,
    },
  },
}))
vi.mock('@/lib/integrity/run-goal-probe', () => ({
  runGoalProbe: mocks.runGoalProbe,
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
          config: {
            startUrl: 'https://shop.example/products/widget',
            steps: [{ action: 'wait', waitMs: 1_000 }],
            goal: { type: 'url_pattern', pattern: '/checkouts?(/|$|\\?)', description: 'Reach the checkout page' },
            safety: 'stop-at-checkout',
            allowLocalhost: false,
          },
        }],
      } }],
      audit: { url: 'https://shop.example' },
    })
    mocks.journeyFindFirst.mockResolvedValue(null)
    mocks.executionFindUnique.mockResolvedValue(null)
    mocks.executionUpsert.mockResolvedValue({ id: 'execution-1' })
    mocks.attemptFindFirst.mockResolvedValue(null)
    mocks.attemptCreateMany.mockResolvedValue({ count: 1 })
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 })
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
      attempts: [
        { outcome: { buyControlFound: true, buyControlClicked: true, cartUpdated: false }, steps: [], videoUrl: null },
        { outcome: { buyControlFound: true, buyControlClicked: true, cartUpdated: false }, steps: [], videoUrl: null },
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

  it('persists blocked execution as inconclusive evidence without a Flag', async () => {
    mocks.runPathProbe.mockResolvedValue({
      health: 'UNKNOWN',
      reason: 'bot_wall',
      confirmed: false,
      steps: [],
      attempts: [{ outcome: { botWall: true }, steps: [], videoUrl: null }],
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

  it('keeps both confirmation walks and records no transient failure when a Flag is confirmed', async () => {
    mocks.runPathProbe.mockResolvedValue({
      health: 'RED',
      reason: 'add_to_cart_noop',
      confirmed: true,
      steps: [],
      attempts: [
        { outcome: { buyControlFound: true, buyControlClicked: true, cartUpdated: false }, steps: [], videoUrl: '/a.webm' },
        { outcome: { buyControlFound: true, buyControlClicked: true, cartUpdated: false }, steps: [], videoUrl: '/b.webm' },
      ],
      finalUrl: 'https://shop.example/products/widget',
      failedStep: 'add_to_cart',
    })

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.attemptCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ attempt: 1, disposition: 'FAILED', reason: 'add_to_cart_noop', executionId: 'execution-1' }),
        expect.objectContaining({ attempt: 2, disposition: 'FAILED', reason: 'add_to_cart_noop', executionId: 'execution-1' }),
      ],
    })
    // No attempt succeeded, so the reproducible failure stays customer facing.
    expect(mocks.attemptUpdateMany).not.toHaveBeenCalled()
  })

  it('retains a recovered first walk as transient flakiness instead of a Flag', async () => {
    mocks.runPathProbe.mockResolvedValue({
      health: 'UNKNOWN',
      reason: 'flaky',
      confirmed: false,
      steps: [],
      attempts: [
        { outcome: { buyControlFound: true, buyControlClicked: true, cartUpdated: false }, steps: [], videoUrl: null },
        {
          outcome: { reachedCheckout: true, buyControlClicked: true, cartUpdated: true },
          steps: [],
          videoUrl: null,
          finalUrl: 'https://shop.example/checkout',
        },
      ],
      finalUrl: 'https://shop.example/checkout',
      failedStep: null,
    })

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.attemptCreateMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({ attempt: 1, disposition: 'FAILED' }),
        expect.objectContaining({ attempt: 2, disposition: 'SUCCEEDED' }),
      ],
    })
    expect(mocks.attemptUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ disposition: 'FAILED', transient: false }),
      data: { transient: true },
    }))
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'BLOCKED', reason: 'flaky' }),
    }))
  })

  it('blocks an unauthorized interactive journey before Playwright can cause a side effect', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      selections: [{ outcome: {
        id: 'outcome-signup',
        kind: 'SIGNUP',
        bindings: [{
          key: 'signup-browser-v1',
          mechanism: 'BROWSER_JOURNEY',
          required: true,
          config: {
            startUrl: 'https://shop.example/account/register',
            steps: [
              { action: 'fill', role: 'textbox', name: 'Email', value: 'probe@example.com' },
              { action: 'click', role: 'button', name: 'Create account' },
            ],
            goal: { type: 'url_pattern', pattern: '/account' },
            goalAfterStep: 2,
            safety: 'none',
          },
        }],
      } }],
      audit: { url: 'https://shop.example' },
    })

    await expect(runBoundCheckoutForAudit('audit-1')).resolves.toBe(true)

    expect(mocks.runGoalProbe).not.toHaveBeenCalled()
    expect(mocks.runPathProbe).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({
        outcomeId: 'outcome-signup',
        disposition: 'BLOCKED',
        reason: 'binding_configuration_invalid',
      }),
    }))
  })

  it('blocks a wait-only protected journey before a preexisting goal can Clear it', async () => {
    mocks.runFindFirst.mockResolvedValue({
      id: 'run-1',
      selections: [{ outcome: {
        id: 'outcome-reset',
        kind: 'PASSWORD_RESET',
        bindings: [{
          key: 'password-reset-browser-v1',
          mechanism: 'BROWSER_JOURNEY',
          required: true,
          config: {
            startUrl: 'https://shop.example/account/recover',
            steps: [{ action: 'wait', waitMs: 10 }],
            goal: { type: 'text_present', text: 'Reset password' },
            safety: 'none',
          },
        }],
      } }],
      audit: { url: 'https://shop.example' },
    })
    await expect(runBoundCheckoutForAudit('audit-1')).resolves.toBe(true)
    expect(mocks.runGoalProbe).not.toHaveBeenCalled()
    expect(mocks.runPathProbe).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ reason: 'protected_fixture_required' }),
    }))
  })

  it('reuses a stored purchase walk without probing again', async () => {
    mocks.journeyFindFirst.mockResolvedValue({
      goalAchieved: true,
      blockedReason: null,
      steps: [
        { actionType: 'add_to_cart', actionDetail: { label: 'add_to_cart' } },
        { actionType: 'checkout', actionDetail: { label: 'checkout' } },
      ],
    })

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.runPathProbe).not.toHaveBeenCalled()
    expect(mocks.executionUpsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ disposition: 'SUCCEEDED', reason: 'checkout_reached' }),
    }))
  })

  it('does not copy a goal-achieved review that never bought', async () => {
    mocks.journeyFindFirst.mockResolvedValue({
      goalAchieved: true,
      blockedReason: null,
      steps: [
        { actionType: 'navigate', actionDetail: { label: 'landing' } },
        { actionType: 'checkout', actionDetail: { label: 'checkout' } },
      ],
    })
    mocks.runPathProbe.mockResolvedValue({
      health: 'UNKNOWN',
      reason: 'no_buy_control',
      confirmed: false,
      steps: [],
      attempts: [{
        outcome: { buyControlFound: false, buyControlClicked: false, reachedCheckout: false },
        steps: [],
        videoUrl: null,
        finalUrl: 'https://shop.example/products/widget',
      }],
      finalUrl: 'https://shop.example/products/widget',
      failedStep: 'add_to_cart',
    })

    await runBoundCheckoutForAudit('audit-1')

    expect(mocks.runPathProbe).toHaveBeenCalled()
    expect(mocks.persistJourneyResult).toHaveBeenCalledWith(
      'audit-1',
      expect.objectContaining({ goalAchieved: false, findings: [] }),
    )
    expect(mocks.executionUpsert.mock.calls.some((call) => call[0]?.create?.disposition === 'SUCCEEDED')).toBe(false)
  })
})
