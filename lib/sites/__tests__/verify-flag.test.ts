import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  loadSiteRecord: vi.fn(),
  loadSiteFlagDetail: vi.fn(),
  executeProductCommand: vi.fn(),
  createAndEnqueueAudit: vi.fn(),
}))

vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord: mocks.loadSiteRecord }))
vi.mock('@/lib/sites/flags', () => ({ loadSiteFlagDetail: mocks.loadSiteFlagDetail }))
vi.mock('@/lib/products/application/commands', () => ({
  executeProductCommand: mocks.executeProductCommand,
}))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit: mocks.createAndEnqueueAudit,
}))
vi.mock('@/lib/sites/outcomes', () => ({ confirmSiteOutcome: vi.fn() }))

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
      pageUrl: 'https://example.com/contact',
      expectedBehavior: 'Contact form shows a confirmation after submit',
    })
    mocks.executeProductCommand.mockResolvedValue({ attemptId: 'att_1' })
    mocks.createAndEnqueueAudit.mockResolvedValue({
      auditId: 'child_1',
      siteId: 'proj_1',
    })
  })

  it('records READY_TO_VERIFY and scopes capture to the Flag page', async () => {
    const result = await executeSiteCommand({
      type: 'VERIFY_FLAG',
      siteId: 'proj_1',
      userId: 'user_1',
      flagId: 'flag_1',
      sourceAuditId: 'parent_1',
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
    expect(mocks.createAndEnqueueAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://example.com/contact',
        parentId: 'parent_1',
        auditMode: 'SINGLE',
      })
    )
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
  })
})
