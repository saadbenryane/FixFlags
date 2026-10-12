import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  runFindFirst: vi.fn(),
  runUpdateMany: vi.fn(),
  journeyFindFirst: vi.fn(),
  executionFindUnique: vi.fn(),
  executionCreate: vi.fn(),
  attemptFindFirst: vi.fn(),
  attemptCreateMany: vi.fn(),
  attemptUpdateMany: vi.fn(),
  runGoalProbe: vi.fn(),
  runPathProbe: vi.fn(),
  persistJourneyResult: vi.fn(),
  flagUpdateMany: vi.fn(), flagFindFirst: vi.fn(),
  flagCreate: vi.fn(), safeForm: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
      $queryRaw: vi.fn(async () => [{ id: 'audit-1' }]),
      outcomeBindingExecution: { findUnique: mocks.executionFindUnique, create: mocks.executionCreate },
      outcomeBindingAttempt: { findFirst: mocks.attemptFindFirst, createMany: mocks.attemptCreateMany, updateMany: mocks.attemptUpdateMany },
      auditPipelineEvent: { create: vi.fn(async () => ({})) },
      flag: { create: mocks.flagCreate },
    }),
    runRequest: {
      findFirst: mocks.runFindFirst,
      updateMany: mocks.runUpdateMany,
    },
    journeyReview: { findFirst: mocks.journeyFindFirst },
    flag: { updateMany: mocks.flagUpdateMany, findFirst: mocks.flagFindFirst },
    outcomeBindingExecution: {
      findUnique: mocks.executionFindUnique,
      create: mocks.executionCreate,
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
vi.mock('@/lib/sites/application/safe-form-executor', () => ({ executeSafeFormFixture: mocks.safeForm }))

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
    mocks.executionCreate.mockResolvedValue({ id: 'execution-1' })
    mocks.attemptFindFirst.mockResolvedValue(null)
    mocks.attemptCreateMany.mockResolvedValue({ count: 1 })
    mocks.attemptUpdateMany.mockResolvedValue({ count: 0 })
    mocks.runUpdateMany.mockResolvedValue({ count: 1 })
    mocks.persistJourneyResult.mockResolvedValue([])
    mocks.flagUpdateMany.mockResolvedValue({ count: 1 })
    mocks.flagFindFirst.mockResolvedValue({ id: 'checkout-flag' })
    mocks.flagCreate.mockResolvedValue({ id: 'signup-flag' })
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
      { outcomeId: 'outcome-1', bindingKey: 'checkout-browser-v1' },
    )
    expect(mocks.flagFindFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { auditId: 'audit-1', fingerprint: 'outcome:v1:outcome-1:checkout-browser-v1' } }))
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ detail: expect.objectContaining({ failureFlagId: 'checkout-flag' }) }) }))
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
      { outcomeId: 'outcome-1', bindingKey: 'checkout-browser-v1' },
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
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'BLOCKED', reason: 'flaky' }),
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
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        outcomeId: 'outcome-signup',
        disposition: 'BLOCKED',
        reason: 'binding_configuration_invalid',
      }),
    }))
  })

  it('publishes a confirmed authorized signup failure with its exact execution reference', async () => {
    mocks.runFindFirst.mockResolvedValue({ id: 'run-1', projectId: 'site-1', audit: { url: 'https://shop.example' }, selections: [{ outcome: {
      id: 'signup-1', kind: 'SIGNUP', bindings: [{ key: 'signup-v1', mechanism: 'SAFE_FORM', required: true,
        config: { startUrl: 'https://shop.example/signup', safety: 'reversible', authorized: true, fixtureId: 'fixture-1' } }],
    } }] })
    mocks.safeForm.mockResolvedValue({ disposition: 'FAILED', reason: 'success_text_missing', detail: { fieldCount: 1, cleanupStatus: 'succeeded' } })
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.safeForm).toHaveBeenCalledTimes(1)
    expect(mocks.flagCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      checkId: 'outcome-signup-failed', fingerprint: 'outcome:v1:signup-1:signup-v1', pageUrl: 'https://shop.example/signup',
    }) })
    expect(mocks.executionCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      disposition: 'FAILED', detail: { fieldCount: 1, cleanupStatus: 'succeeded', failureFlagId: 'signup-flag' },
    }) })
    expect(mocks.persistJourneyResult).not.toHaveBeenCalled()
    mocks.executionFindUnique.mockResolvedValue({ id: 'execution-1' })
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.safeForm).toHaveBeenCalledTimes(1)
    expect(mocks.flagCreate).toHaveBeenCalledTimes(1)
  })

  it('records cleanup uncertainty without creating a signup Flag', async () => {
    mocks.runFindFirst.mockResolvedValue({ id: 'run-1', projectId: 'site-1', audit: { url: 'https://shop.example' }, selections: [{ outcome: {
      id: 'signup-1', kind: 'SIGNUP', bindings: [{ key: 'signup-v1', mechanism: 'SAFE_FORM', required: true,
        config: { startUrl: 'https://shop.example/signup', safety: 'reversible', authorized: true, fixtureId: 'fixture-1' } }],
    } }] })
    mocks.safeForm.mockResolvedValue({ disposition: 'BLOCKED', reason: 'fixture_cleanup_unproven', detail: { fieldCount: 1, cleanupStatus: 'failed' } })
    await runBoundCheckoutForAudit('audit-1')
    expect(mocks.flagCreate).not.toHaveBeenCalled()
    expect(mocks.executionCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ disposition: 'BLOCKED', reason: 'fixture_cleanup_unproven' }) })
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
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ reason: 'protected_fixture_required' }),
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
    expect(mocks.executionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ disposition: 'SUCCEEDED', reason: 'checkout_reached' }),
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
      { outcomeId: 'outcome-1', bindingKey: 'checkout-browser-v1' },
    )
    expect(mocks.executionCreate.mock.calls.some((call) => call[0]?.data?.disposition === 'SUCCEEDED')).toBe(false)
  })
})
