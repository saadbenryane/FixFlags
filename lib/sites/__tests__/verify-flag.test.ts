import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadSiteRecord: vi.fn(),
  loadSiteFlagDetail: vi.fn(),
  executeProductCommand: vi.fn(),
  createAndEnqueueAudit: vi.fn(),
  requestOutcomeRun: vi.fn(),
  requestSiteRun: vi.fn(),
  findReusableRun: vi.fn(),
  outcomeFindMany: vi.fn(),
  assessmentUpsert: vi.fn(),
}))

vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.loadSiteRecord }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.loadSiteFlagDetail }))
vi.mock('@/lib/products/application/commands', () => ({
  executeProductCommand: mocks.executeProductCommand,
}))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit: mocks.createAndEnqueueAudit,
}))
vi.mock('@/lib/db', () => ({
  prisma: {
    siteOutcome: { findMany: mocks.outcomeFindMany },
    outcomeAssessment: { upsert: mocks.assessmentUpsert },
  },
}))
vi.mock('@/lib/sites/application/run-requests', () => ({
  requestOutcomeRun: mocks.requestOutcomeRun,
  requestSiteRun: mocks.requestSiteRun,
  findReusableRun: mocks.findReusableRun,
}))
vi.mock('@/lib/sites/outcomes', () => ({ confirmSiteOutcome: vi.fn() }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn() }))

import { executeSiteCommand } from '@/lib/sites/application/commands'

describe('VERIFY_FLAG', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.loadSiteRecord.mockResolvedValue({
      siteId: 'proj_1',
      kind: 'project',
      projectId: 'proj_1',
      url: 'https://example.com',
      canonicalHost: 'example.com',
    })
    mocks.loadSiteFlagDetail.mockResolvedValue({
      id: 'flag_1',
      sourceAuditId: 'parent_1',
      checkId: 'form-feedback',
      pageUrl: 'https://example.com/contact',
      expectedBehavior: 'Contact form shows a confirmation after submit',
    })
    mocks.executeProductCommand.mockResolvedValue({ attemptId: 'att_1' })
    mocks.outcomeFindMany.mockResolvedValue([{ id: 'outcome-1' }])
    mocks.requestSiteRun.mockResolvedValue({ runId: 'run_1', auditId: 'child_1', outcomeIds: ['outcome-1'], reused: false })
    mocks.findReusableRun.mockResolvedValue(null)
    mocks.requestOutcomeRun.mockResolvedValue({ runId: 'run_1', auditId: 'child_1', reused: false })
  })

  it('records READY_TO_VERIFY and scopes capture to the Flag page', async () => {
    const result = await executeSiteCommand({
      type: 'VERIFY_FLAG',
      siteId: 'proj_1',
      userId: 'user_1',
      flagId: 'flag_1',
    })

    expect(result).toMatchObject({
      ok: true,
      attemptId: 'att_1',
      verificationAuditId: 'child_1',
    })
    expect(mocks.executeProductCommand).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RECORD_FLAG_ACTION',
        action: 'READY_TO_VERIFY',
        flagId: 'flag_1',
        changeSummary: 'Contact form shows a confirmation after submit',
      })
    )
    expect(mocks.requestSiteRun).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/contact',
        parentAuditId: 'parent_1',
        outcomeIds: ['outcome-1'],
        verificationAttemptId: 'att_1',
        source: 'WEB',
      })
    )
    expect(result).toMatchObject({ runId: 'run_1' })
    expect(mocks.createAndEnqueueAudit).not.toHaveBeenCalled()
  })

  it('does not treat copy handoff as verify', async () => {
    await executeSiteCommand({
      type: 'RECORD_FIX_HANDOFF',
      flagId: 'flag_1',
      userId: 'user_1',
      builder: 'copy',
    })
    expect(mocks.executeProductCommand).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'HANDOFF_COPIED' })
    )
    expect(mocks.createAndEnqueueAudit).not.toHaveBeenCalled()
    expect(mocks.requestOutcomeRun).not.toHaveBeenCalled()
    expect(mocks.requestSiteRun).not.toHaveBeenCalled()
    expect(mocks.assessmentUpsert).not.toHaveBeenCalled()
  })

  it('re-verifies an Outcome Flag through the shared RunRequest path', async () => {
    mocks.loadSiteFlagDetail.mockResolvedValue({
      id: 'flag_1', sourceAuditId: 'parent_1', outcomeId: 'checkout_1',
      checkId: 'journey-checkout-failed-add_to_cart_noop',
      pageUrl: 'https://example.com/products/widget',
      expectedBehavior: 'The selected product appears in the cart and checkout opens.',
    })

    const result = await executeSiteCommand({
      type: 'VERIFY_FLAG', siteId: 'proj_1', userId: 'user_1', flagId: 'flag_1',
    })

    expect(result).toMatchObject({ ok: true, runId: 'run_1', verificationAuditId: 'child_1' })
    expect(mocks.requestOutcomeRun).toHaveBeenCalledWith(expect.objectContaining({
      projectId: 'proj_1', outcomeId: 'checkout_1', source: 'WEB',
      verificationAttemptId: 'att_1', parentAuditId: 'parent_1',
    }))
    expect(mocks.createAndEnqueueAudit).not.toHaveBeenCalled()
  })
})
