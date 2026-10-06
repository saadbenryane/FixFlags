import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SiteRecord } from '@/lib/sites/types'
import { OUTCOME_DETAIL_COPY } from '@/lib/marketing/copy/workspace'
import { summaryFor } from '@/lib/sites/application/binding-assessment'
import { availabilityCouldNotVerifyRecovery, checkoutCouldNotVerifyRecovery, checkoutResultCopy, customerBindingResult, outcomeStatusLabel } from '@/lib/sites/outcome-state'

const mocks = vi.hoisted(() => ({
  outcomeFindFirst: vi.fn(),
  pageFindMany: vi.fn(),
  executionFindMany: vi.fn(),
  assessmentFindFirst: vi.fn(),
  improvementFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findFirst: mocks.outcomeFindFirst },
    sitePage: { findMany: mocks.pageFindMany },
    outcomeBindingExecution: { findMany: mocks.executionFindMany },
    outcomeAssessment: { findFirst: mocks.assessmentFindFirst },
    improvement: { findMany: mocks.improvementFindMany },
  },
}))

import { loadSiteOutcomeDetail } from '@/lib/sites/outcomes'

const OLDER = new Date('2026-10-01T12:00:00.000Z')
const AVAILABILITY_OLDER = new Date('2026-10-02T12:00:00.000Z')
const AVAILABILITY_NEWER = new Date('2026-10-04T12:00:00.000Z')
const NEWER = new Date('2026-10-05T18:00:00.000Z')

function projectSite(): SiteRecord {
  return {
    siteId: 'project-1',
    kind: 'project',
    url: 'https://shop.example',
    canonicalHost: 'shop.example',
    name: 'Shop',
    projectId: 'project-1',
    provisionalSiteId: null,
    primaryAuditId: 'audit-new',
    watchInterval: null,
    watchNextRunAt: null,
    watchLastRunAt: null,
    watchLastError: null,
    watchConsecutiveFailures: 0,
    userId: 'user-1',
  }
}

function outcomeRow() {
  return {
    id: 'outcome-1',
    name: 'Checkout',
    slug: 'checkout',
    description: null,
    inferenceSource: 'browser',
    confirmedAt: null,
    pages: [{ pageId: 'page-1' }],
    kind: 'CHECKOUT' as const,
    criticality: 'CRITICAL' as const,
    environment: 'production',
    enabled: true,
    staleAfterMinutes: 10080,
    expectation: 'The selected product appears in the cart and checkout opens.',
    bindings: [
      { key: 'checkout-browser-v1', required: true, scope: null, mechanism: 'BROWSER_JOURNEY', version: 1 },
      { key: 'page-availability-v1', required: false, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 },
      { key: 'supporting-observation-v1', required: false, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 },
    ],
    assessments: [{
      id: 'assessment-new',
      state: 'CLEAR' as const,
      summary: checkoutResultCopy('checkout_reached').summary,
      assessedAt: NEWER,
      validUntil: new Date(Date.now() + 60 * 60 * 1000),
      improvementId: null,
      runRequestId: 'run-new',
      coverage: null,
      auditId: 'audit-new',
    }],
    runSelections: [{
      runRequest: {
        id: 'run-new',
        status: 'COMPLETED',
        requestedAt: NEWER,
        errorMessage: null,
        auditId: 'audit-new',
      },
    }],
    bindingAttempts: [
      {
        id: 'attempt-new',
        bindingKey: 'checkout-browser-v1',
        disposition: 'SUCCEEDED',
        reason: 'checkout_reached',
        createdAt: NEWER,
        auditId: 'audit-new',
      },
      {
        id: 'attempt-old',
        bindingKey: 'checkout-browser-v1',
        disposition: 'BLOCKED',
        reason: 'no_buy_control',
        createdAt: OLDER,
        auditId: 'audit-old',
      },
    ],
  }
}

/** Newest first, matching `orderBy: { createdAt: 'desc' }`. */
function executionsNewestFirst() {
  return [
    {
      id: 'exec-checkout-new',
      bindingKey: 'checkout-browser-v1',
      disposition: 'SUCCEEDED',
      reason: 'checkout_reached',
      detail: { finalUrl: 'https://shop.example/checkout' },
      createdAt: NEWER,
      auditId: 'audit-new',
    },
    {
      id: 'exec-page-new',
      bindingKey: 'page-availability-v1',
      disposition: 'FAILED',
      reason: 'http_unavailable',
      detail: null,
      createdAt: AVAILABILITY_NEWER,
      auditId: 'audit-page-new',
    },
    {
      id: 'exec-page-old',
      bindingKey: 'page-availability-v1',
      disposition: 'SUCCEEDED',
      reason: 'http_ok',
      detail: null,
      createdAt: AVAILABILITY_OLDER,
      auditId: 'audit-page-old',
    },
    {
      id: 'exec-checkout-old',
      bindingKey: 'checkout-browser-v1',
      disposition: 'BLOCKED',
      reason: 'no_buy_control',
      detail: null,
      createdAt: OLDER,
      auditId: 'audit-old',
    },
  ]
}

describe('loadSiteOutcomeDetail newest execution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.outcomeFindFirst.mockResolvedValue(outcomeRow())
    mocks.pageFindMany.mockResolvedValue([{ id: 'page-1', url: 'https://shop.example/products/tote' }])
    mocks.assessmentFindFirst.mockResolvedValue({ assessedAt: NEWER })
    mocks.improvementFindMany.mockResolvedValue([])
    mocks.executionFindMany.mockResolvedValue(executionsNewestFirst())
  })

  it('shows the newest execution for each binding and keeps older attempts in history', async () => {
    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(mocks.outcomeFindFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'outcome-1', projectId: 'project-1' },
    }))
    expect(mocks.executionFindMany).toHaveBeenCalledWith({
      where: { outcomeId: 'outcome-1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    expect(detail).not.toBeNull()
    expect(detail?.state).toBe('CLEAR')
    expect(detail?.timeline.find((event) => event.type === 'assessment')?.title).toBe(outcomeStatusLabel('CLEAR'))
    expect(detail?.summary).toBe(checkoutResultCopy('checkout_reached').summary)
    expect(detail?.pageUrls).toEqual(['https://shop.example/products/tote'])

    const checkout = detail?.bindings.find((binding) => binding.key === 'checkout-browser-v1')
    const availability = detail?.bindings.find((binding) => binding.key === 'page-availability-v1')
    const untouched = detail?.bindings.find((binding) => binding.key === 'supporting-observation-v1')

    expect(checkout?.latestEvidence).toEqual({
      disposition: 'SUCCEEDED',
      reason: 'checkout_reached',
      detail: { finalUrl: 'https://shop.example/checkout' },
      createdAt: NEWER.toISOString(),
      auditId: 'audit-new',
    })
    expect(customerBindingResult({
      key: 'checkout-browser-v1',
      disposition: checkout!.latestEvidence!.disposition,
      reason: checkout!.latestEvidence!.reason,
    })).toEqual({
      headline: checkoutResultCopy('checkout_reached').summary,
      detail: checkoutResultCopy('checkout_reached').evidence,
    })
    expect(customerBindingResult({
      key: 'checkout-browser-v1',
      disposition: checkout!.latestEvidence!.disposition,
      reason: checkout!.latestEvidence!.reason,
    }).headline).not.toBe(checkoutResultCopy('no_buy_control').summary)

    expect(availability?.latestEvidence).toEqual({
      disposition: 'FAILED',
      reason: 'http_unavailable',
      detail: null,
      createdAt: AVAILABILITY_NEWER.toISOString(),
      auditId: 'audit-page-new',
    })
    expect(customerBindingResult({
      key: 'page-availability-v1',
      disposition: availability!.latestEvidence!.disposition,
      reason: availability!.latestEvidence!.reason,
    }).headline).toBe(summaryFor('http_unavailable', 'FLAG'))

    expect(untouched?.latestEvidence).toBeNull()
    expect(detail?.timeline.filter((event) => event.type === 'attempt').map((event) => event.id)).toEqual([
      'attempt:attempt-new',
      'attempt:attempt-old',
    ])
    expect(detail?.limitation).toBeNull()
    expect(detail?.recoveryAction).toBeNull()
  })

  it('tells a blocked Checkout how to try the purchase again', async () => {
    const row = outcomeRow()
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'COULD_NOT_VERIFY',
      summary: checkoutResultCopy('no_buy_control').summary,
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: 'exec-checkout-new',
        bindingKey: 'checkout-browser-v1',
        disposition: 'BLOCKED',
        reason: 'no_buy_control',
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
      {
        id: 'exec-checkout-old',
        bindingKey: 'checkout-browser-v1',
        disposition: 'SUCCEEDED',
        reason: 'checkout_reached',
        detail: { finalUrl: 'https://shop.example/checkout' },
        createdAt: OLDER,
        auditId: 'audit-old',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.state).toBe('COULD_NOT_VERIFY')
    expect(detail?.limitation).toBe(checkoutResultCopy('no_buy_control').summary)
    expect(detail?.bindings.find((binding) => binding.key === 'checkout-browser-v1')?.latestEvidence?.reason).toBe('no_buy_control')
    expect(detail?.recoveryAction).toBe('Check a page that has Add to cart or Buy, then verify again.')
    expect(detail?.recoveryAction).not.toContain('fixture')
  })

  it('uses the challenge next step when bot protection blocks Checkout', async () => {
    const row = outcomeRow()
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'COULD_NOT_VERIFY',
      summary: checkoutResultCopy('bot_wall').summary,
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: 'exec-bot',
        bindingKey: 'checkout-browser-v1',
        disposition: 'BLOCKED',
        reason: 'bot_wall',
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.recoveryAction).toBe('Verify again when the independent browser can pass the challenge.')
    expect(detail?.recoveryAction).toBe(checkoutCouldNotVerifyRecovery('bot_wall'))
  })

  it.each([
    ['password_gate', 'Provide access for this checkout, then verify again.'],
    ['timeout', 'Verify again. The last check reached the time limit.'],
    ['flaky', 'Verify again. The repeated purchase attempts did not agree.'],
    ['unrecognized', 'Verify again.'],
  ] as const)('uses the Checkout next step for %s', async (reason, recovery) => {
    const row = outcomeRow()
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'COULD_NOT_VERIFY',
      summary: checkoutResultCopy(reason).summary,
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: `exec-${reason}`,
        bindingKey: 'checkout-browser-v1',
        disposition: 'BLOCKED',
        reason,
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.recoveryAction).toBe(recovery)
    expect(detail?.recoveryAction).toBe(checkoutCouldNotVerifyRecovery(reason))
    expect(detail?.recoveryAction).not.toContain('fixture')
  })

  it('tells a blocked page to use a public address', async () => {
    const row = outcomeRow()
    row.kind = 'AVAILABILITY'
    row.name = 'This page loads'
    row.slug = 'this-page-loads'
    row.bindings = [
      { key: 'page-availability-v1', required: true, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 },
    ]
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'COULD_NOT_VERIFY',
      summary: summaryFor('not_public', 'COULD_NOT_VERIFY'),
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: 'exec-page-new',
        bindingKey: 'page-availability-v1',
        disposition: 'BLOCKED',
        reason: 'not_public',
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
      {
        id: 'exec-page-old',
        bindingKey: 'page-availability-v1',
        disposition: 'SUCCEEDED',
        reason: 'available',
        detail: null,
        createdAt: OLDER,
        auditId: 'audit-old',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.state).toBe('COULD_NOT_VERIFY')
    expect(detail?.limitation).toBe(summaryFor('not_public', 'COULD_NOT_VERIFY'))
    expect(detail?.bindings.find((binding) => binding.key === 'page-availability-v1')?.latestEvidence?.reason).toBe('not_public')
    expect(detail?.recoveryAction).toBe('Use a public page address, then verify again.')
    expect(detail?.recoveryAction).toBe(availabilityCouldNotVerifyRecovery('not_public'))
    expect(detail?.recoveryAction).not.toBe('Review the method or fixture, then verify again.')
  })

  it.each([
    ['redirect_unfollowed', 'Use the page that answers directly, then verify again.'],
    ['bot_wall', 'Verify again when a public request can pass the challenge.'],
    ['rendered_surface_unavailable', 'Verify again. The last check had no rendered page to read.'],
    ['request_failed', 'Verify again. The last request did not complete.'],
    ['unrecognized', 'Verify again.'],
  ] as const)('uses the page next step for %s', async (reason, recovery) => {
    const row = outcomeRow()
    row.kind = 'AVAILABILITY'
    row.name = 'This page loads'
    row.slug = 'this-page-loads'
    row.bindings = [
      { key: 'page-availability-v1', required: true, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 },
    ]
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'COULD_NOT_VERIFY',
      summary: summaryFor(reason, 'COULD_NOT_VERIFY'),
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: `exec-${reason}`,
        bindingKey: 'page-availability-v1',
        disposition: 'BLOCKED',
        reason,
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.recoveryAction).toBe(recovery)
    expect(detail?.recoveryAction).toBe(availabilityCouldNotVerifyRecovery(reason))
    expect(detail?.recoveryAction).not.toContain('fixture')
  })

  it('leaves an unavailable-page Flag repair off the Outcome recovery line', async () => {
    const row = outcomeRow()
    row.kind = 'AVAILABILITY'
    row.name = 'This page loads'
    row.slug = 'this-page-loads'
    row.bindings = [
      { key: 'page-availability-v1', required: true, scope: null, mechanism: 'HTTP_AVAILABILITY', version: 1 },
    ]
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'FLAG',
      summary: summaryFor('http_unavailable', 'FLAG'),
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: 'exec-http',
        bindingKey: 'page-availability-v1',
        disposition: 'FAILED',
        reason: 'http_unavailable',
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.state).toBe('FLAG')
    expect(detail?.recoveryAction).toBeNull()
  })

  it('keeps the fixture next step for a protected Signup', async () => {
    const row = outcomeRow()
    row.kind = 'SIGNUP'
    row.name = 'Signup'
    row.slug = 'signup'
    row.bindings = [
      { key: 'signup-safe-form-v1', required: true, scope: null, mechanism: 'SAFE_FORM', version: 1 },
    ]
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'COULD_NOT_VERIFY',
      summary: 'This flow is protected, so FixFlags did not submit it.',
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: 'exec-signup',
        bindingKey: 'signup-safe-form-v1',
        disposition: 'BLOCKED',
        reason: 'protected_or_irreversible',
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.recoveryAction).toBe('Review the method or fixture, then verify again.')
  })

  it('leaves a Checkout Flag repair off the Outcome recovery line', async () => {
    const row = outcomeRow()
    row.assessments[0] = {
      ...row.assessments[0],
      state: 'FLAG',
      summary: checkoutResultCopy('add_to_cart_noop').summary,
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)
    mocks.executionFindMany.mockResolvedValue([
      {
        id: 'exec-flag',
        bindingKey: 'checkout-browser-v1',
        disposition: 'FAILED',
        reason: 'add_to_cart_noop',
        detail: null,
        createdAt: NEWER,
        auditId: 'audit-new',
      },
    ])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')

    expect(detail?.state).toBe('FLAG')
    expect(detail?.recoveryAction).toBeNull()
  })

  it('states each history attempt in customer words', async () => {
    const row = outcomeRow()
    row.bindingAttempts = [
      {
        id: 'attempt-checkout-new',
        bindingKey: 'checkout-browser-v1',
        disposition: 'SUCCEEDED',
        reason: 'checkout_reached',
        createdAt: NEWER,
        auditId: 'audit-new',
      },
      {
        id: 'attempt-page',
        bindingKey: 'page-availability-v1',
        disposition: 'BLOCKED',
        reason: 'not_public',
        createdAt: AVAILABILITY_NEWER,
        auditId: 'audit-page',
      },
      {
        id: 'attempt-signup',
        bindingKey: 'signup-safe-form-v1',
        disposition: 'BLOCKED',
        reason: 'protected_or_irreversible',
        createdAt: AVAILABILITY_OLDER,
        auditId: 'audit-signup',
      },
      {
        id: 'attempt-checkout-old',
        bindingKey: 'checkout-browser-v1',
        disposition: 'BLOCKED',
        reason: 'no_buy_control',
        createdAt: OLDER,
        auditId: 'audit-old',
      },
    ]
    mocks.outcomeFindFirst.mockResolvedValue(row)

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')
    const attempts = detail?.timeline.filter((event) => event.type === 'attempt') ?? []
    const checkoutReached = customerBindingResult({
      key: 'checkout-browser-v1',
      disposition: 'SUCCEEDED',
      reason: 'checkout_reached',
    })
    const checkoutBlocked = customerBindingResult({
      key: 'checkout-browser-v1',
      disposition: 'BLOCKED',
      reason: 'no_buy_control',
    })
    const pageBlocked = customerBindingResult({
      key: 'page-availability-v1',
      disposition: 'BLOCKED',
      reason: 'not_public',
    })
    const signupBlocked = customerBindingResult({
      key: 'signup-safe-form-v1',
      disposition: 'BLOCKED',
      reason: 'protected_or_irreversible',
    })

    expect(attempts.map((event) => ({ id: event.id, title: event.title, detail: event.detail }))).toEqual([
      { id: 'attempt:attempt-checkout-new', title: checkoutReached.headline, detail: checkoutReached.detail ?? '' },
      { id: 'attempt:attempt-page', title: pageBlocked.headline, detail: pageBlocked.detail ?? '' },
      { id: 'attempt:attempt-signup', title: signupBlocked.headline, detail: signupBlocked.detail ?? '' },
      { id: 'attempt:attempt-checkout-old', title: checkoutBlocked.headline, detail: checkoutBlocked.detail ?? '' },
    ])
    for (const event of attempts) {
      expect(event.title).not.toMatch(/checkout-browser-v1|page-availability-v1|signup-safe-form-v1/)
      expect(event.detail).not.toMatch(/checkout_reached|no_buy_control|not_public|protected_or_irreversible/)
    }
  })

  it('names each method with the evidence-card sentence', async () => {
    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')
    const checkout = detail?.bindings.find((binding) => binding.key === 'checkout-browser-v1')
    const page = detail?.bindings.find((binding) => binding.key === 'page-availability-v1')
    const untouched = detail?.bindings.find((binding) => binding.key === 'supporting-observation-v1')
    const checkoutSentence = customerBindingResult({
      key: 'checkout-browser-v1',
      disposition: 'SUCCEEDED',
      reason: 'checkout_reached',
    })
    const pageSentence = customerBindingResult({
      key: 'page-availability-v1',
      disposition: 'FAILED',
      reason: 'http_unavailable',
    })

    expect(checkout?.customerSentence).toBe(checkoutSentence.headline)
    expect(page?.customerSentence).toBe(pageSentence.headline)
    expect(untouched?.customerSentence).toBe(OUTCOME_DETAIL_COPY.noEvidence)
    expect(checkout?.customerSentence).not.toContain('checkout-browser-v1')
    expect(page?.customerSentence).not.toContain('page-availability-v1')
    expect(untouched?.customerSentence).not.toContain('supporting-observation-v1')
    expect(checkout?.customerSentence).not.toContain('version')
  })

  it('names an expired Clear assessment Stale and asks for a fresh verification', async () => {
    const row = outcomeRow()
    row.assessments[0] = {
      ...row.assessments[0],
      validUntil: new Date(Date.now() - 60 * 60 * 1000),
    }
    mocks.outcomeFindFirst.mockResolvedValue(row)

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')
    const assessment = detail?.timeline.find((event) => event.type === 'assessment')

    expect(detail?.state).toBe('STALE')
    expect(detail?.limitation).toBeNull()
    expect(detail?.recoveryAction).toBe('Run a fresh verification before relying on this result.')
    expect(assessment?.title).toBe(outcomeStatusLabel('STALE'))
    expect(assessment?.title).not.toBe(outcomeStatusLabel('COULD_NOT_VERIFY'))
    expect(assessment?.detail).toBe(checkoutResultCopy('checkout_reached').summary)
  })

  it('keeps the only stored execution when the binding has run once', async () => {
    mocks.executionFindMany.mockResolvedValue([executionsNewestFirst()[0]])

    const detail = await loadSiteOutcomeDetail(projectSite(), 'outcome-1')
    const checkout = detail?.bindings.find((binding) => binding.key === 'checkout-browser-v1')

    expect(checkout?.latestEvidence?.reason).toBe('checkout_reached')
    expect(checkout?.latestEvidence?.auditId).toBe('audit-new')
    expect(detail?.bindings.find((binding) => binding.key === 'page-availability-v1')?.latestEvidence).toBeNull()
  })
})
