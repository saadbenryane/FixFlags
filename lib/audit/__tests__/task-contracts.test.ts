import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  createAndEnqueueAudit: vi.fn(),
  startMonitoringAudit: vi.fn(),
  pollAuditUntilDone: vi.fn(),
  getFlagDiffSummary: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: { audit: { findUnique: mocks.auditFindUnique } },
}))
vi.mock('@/lib/audit/create-audit', () => ({
  createAndEnqueueAudit: mocks.createAndEnqueueAudit,
}))
vi.mock('@/lib/audit/monitoring', () => ({
  startMonitoringAudit: mocks.startMonitoringAudit,
}))
vi.mock('@/lib/audit/poll-audit', () => ({
  pollAuditUntilDone: mocks.pollAuditUntilDone,
}))
vi.mock('@/lib/audit/diff-flags', () => ({
  getFlagDiffSummary: mocks.getFlagDiffSummary,
}))

import { checkAndPlan, recheckAndCompare } from '@/lib/audit/task-contracts'

const user = {
  id: 'user-1',
  plan: 'BUILDER',
  role: 'user',
  subscriptionStatus: 'ACTIVE',
} as never

function completedAudit() {
  return {
    id: 'report-1',
    url: 'https://example.com/',
    status: 'COMPLETED',
    score: 82,
    verdict: 'One important improvement remains',
    productContract: null,
    flags: [
      {
        id: 'flag-1',
        checkId: 'cta-specificity',
        rubric: 'MESSAGE',
        severity: 'IMPORTANT',
        impactTag: 'CONVERSION',
        problem: 'The CTA is vague',
        evidence: 'The button says Continue',
        whyItMatters: null,
        fix: 'Name the outcome',
        agentPrompt: 'Rename the primary CTA to describe the outcome.',
        cursorPrompt: null,
        claudePrompt: null,
        windsurfPrompt: null,
        lovablePrompt: null,
        boltPrompt: null,
        verificationRule: 'The CTA names the outcome.',
        pageUrl: 'https://example.com/',
        confidence: 0.95,
        source: 'DETERMINISTIC',
      },
    ],
    rubrics: [
      {
        name: 'MESSAGE',
        grade: 'B',
        score: 82,
        flags: [{ severity: 'IMPORTANT' }],
      },
    ],
  }
}

describe('task contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createAndEnqueueAudit.mockResolvedValue({ auditId: 'report-1', status: 'QUEUED' })
    mocks.pollAuditUntilDone.mockResolvedValue({ status: 'COMPLETED', timedOut: false })
    mocks.auditFindUnique.mockResolvedValue(completedAudit())
    mocks.startMonitoringAudit.mockResolvedValue({
      ok: true,
      result: { auditId: 'report-1', status: 'QUEUED' },
    })
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [{ id: 'fixed' }],
      unchanged: [],
      newIssues: [],
      regressed: [],
    })
  })

  it('returns one complete check-to-plan outcome', async () => {
    const outcome = await checkAndPlan({
      url: 'https://example.com',
      userId: 'user-1',
      waitForCompletion: true,
    })

    expect(outcome.status).toBe('COMPLETED')
    expect(outcome.score).toBe(82)
    expect(outcome.finishPlan?.items).toHaveLength(1)
    expect(outcome.finishPlan?.items[0]?.fixPrompt).toMatch(/Rename the primary CTA/)
  })

  it('returns one complete re-check-to-diff outcome', async () => {
    const outcome = await recheckAndCompare({
      parentReportId: 'parent-1',
      user,
      waitForCompletion: true,
    })

    expect(outcome.diff).toEqual({ fixed: 1, remaining: 0, newIssues: 0, regressed: 0 })
    expect(outcome.nextFinishPlan?.items).toHaveLength(1)
    expect(mocks.startMonitoringAudit).toHaveBeenCalledWith('parent-1', user, {
      delayMs: undefined,
    })
  })
})
