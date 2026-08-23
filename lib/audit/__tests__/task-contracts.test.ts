import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  createAndEnqueueAudit: vi.fn(),
  startMonitoringAudit: vi.fn(),
  pollAuditUntilDone: vi.fn(),
  getFlagDiffSummary: vi.fn(),
  occurrenceFindMany: vi.fn(),
  attemptFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: { findUnique: mocks.auditFindUnique },
    improvementOccurrence: { findMany: mocks.occurrenceFindMany },
    improvementAttempt: { findMany: mocks.attemptFindMany },
  },
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
vi.mock('@/lib/audit/technology-profile', () => ({
  loadTechnologyProfile: vi.fn().mockResolvedValue({
    status: 'complete',
    detectorVersion: 'test',
    detectedAt: null,
    technologies: [],
    insight: null,
  }),
}))

import {
  checkAndPlan,
  loadCompletedTaskOutcome,
  recheckAndCompare,
} from '@/lib/audit/task-contracts'

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
    mocks.createAndEnqueueAudit.mockResolvedValue({
      auditId: 'report-1',
      status: 'QUEUED',
      reused: false,
      parentId: null,
    })
    mocks.pollAuditUntilDone.mockResolvedValue({ status: 'COMPLETED', timedOut: false })
    mocks.auditFindUnique.mockResolvedValue(completedAudit())
    mocks.startMonitoringAudit.mockResolvedValue({
      ok: true,
      result: {
        auditId: 'report-1',
        status: 'QUEUED',
        reused: false,
        parentAuditId: 'parent-1',
      },
    })
    mocks.occurrenceFindMany.mockResolvedValue([])
    mocks.attemptFindMany.mockResolvedValue([])
    mocks.getFlagDiffSummary.mockResolvedValue({
      fixed: [{ id: 'fixed' }],
      inconclusive: [],
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
    expect(outcome.fixList?.items).toHaveLength(1)
    expect(outcome.fixList?.totalCount).toBe(1)
    expect(outcome.finishPlan?.items).toHaveLength(1)
    expect(outcome.fixList?.items[0]?.fixPrompt).toMatch(/Rename the primary CTA/)
    expect(outcome.fixList?.items[0]).toMatchObject({
      rank: 1,
      evidence: 'The button says Continue',
      verification: 'The CTA names the outcome.',
      selectedTool: 'universal',
      reportUrl: expect.stringContaining('/report/report-1'),
    })
  })

  it('keeps every unresolved Flag in the Fix List and only three in the Finish Plan', async () => {
    const base = completedAudit()
    mocks.auditFindUnique.mockResolvedValue({
      ...base,
      flags: [
        ...base.flags,
        ...['flag-2', 'flag-3', 'flag-4'].map((id, index) => ({
          ...base.flags[0],
          id,
          checkId: id,
          severity: index === 2 ? 'POLISH' : 'IMPORTANT',
          problem: `Problem ${id}`,
          agentPrompt: `Fix ${id}`,
        })),
      ],
    })

    const outcome = await loadCompletedTaskOutcome('report-1')

    expect(outcome.fixList?.items).toHaveLength(4)
    expect(outcome.fixList?.totalCount).toBe(4)
    expect(outcome.finishPlan?.items).toHaveLength(3)
    expect(outcome.finishPlan?.items.map((item) => item.flagId)).toEqual(
      outcome.fixList?.items.slice(0, 3).map((item) => item.flagId)
    )
    expect(outcome.finishPlan?.planPrompt).not.toContain('Problem flag-4')
  })

  it('returns a typed polling action when checks run asynchronously', async () => {
    const outcome = await checkAndPlan({
      url: 'https://example.com',
      userId: 'user-1',
    })

    expect(outcome.status).toBe('QUEUED')
    expect(outcome.nextAction).toEqual({
      type: 'poll',
      tool: 'ff_get_check_status',
      reportId: 'report-1',
      retryAfterSeconds: 3,
    })
  })

  it('reports a recoverable timeout below the route runtime', async () => {
    mocks.pollAuditUntilDone.mockResolvedValueOnce({
      status: 'CHECKING',
      timedOut: true,
    })

    const outcome = await checkAndPlan({
      url: 'https://example.com',
      userId: 'user-1',
      waitForCompletion: true,
    })

    expect(mocks.pollAuditUntilDone).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 50_000 })
    )
    expect(outcome.error).toEqual({
      code: 'WAIT_TIMEOUT',
      message: 'The synchronous wait ended before the check completed.',
      recoverable: true,
      action: 'poll',
    })
    expect(outcome.nextAction?.tool).toBe('ff_get_check_status')
  })

  it('never substitutes another builder prompt', async () => {
    const outcome = await checkAndPlan({
      url: 'https://example.com',
      userId: 'user-1',
      waitForCompletion: true,
      tool: 'bolt',
    })

    expect(outcome.fixList?.items[0]).toMatchObject({
      selectedTool: 'bolt',
      selectedPrompt: null,
      fixPrompt: null,
    })
  })

  it('returns one complete re-check-to-diff outcome', async () => {
    const outcome = await recheckAndCompare({
      parentReportId: 'parent-1',
      user,
      waitForCompletion: true,
    })

    expect(outcome.diff).toEqual({
      fixed: 1,
      inconclusive: 0,
      remaining: 0,
      newIssues: 0,
      regressed: 0,
      flags: {
        cleared: [{ id: 'fixed' }],
        inconclusive: [],
        remaining: [],
        new: [],
        regressed: [],
      },
    })
    expect(outcome.nextFixList?.items).toHaveLength(1)
    expect(outcome.nextFixList?.totalCount).toBe(1)
    expect(outcome.nextFinishPlan?.items).toHaveLength(1)
    expect(outcome.parentReportId).toBe('parent-1')
    expect(outcome.reused).toBe(false)
    expect(mocks.startMonitoringAudit).toHaveBeenCalledWith('parent-1', user, {
      delayMs: undefined,
      claimedAnonymous: undefined,
      clientId: undefined,
    })
  })

  it('uses the returned Review parent when an active update Review is reused', async () => {
    mocks.startMonitoringAudit.mockResolvedValueOnce({
      ok: true,
      result: {
        auditId: 'report-1',
        status: 'QUEUED',
        reused: true,
        parentAuditId: 'actual-parent',
      },
    })

    const outcome = await recheckAndCompare({
      parentReportId: 'requested-parent',
      user,
      waitForCompletion: true,
    })

    expect(outcome.parentReportId).toBe('actual-parent')
    expect(outcome.reused).toBe(true)
    expect(mocks.getFlagDiffSummary).toHaveBeenCalledWith('actual-parent', 'report-1')
    expect(mocks.getFlagDiffSummary).not.toHaveBeenCalledWith('requested-parent', 'report-1')
  })

  it('resumes an active first Review without fabricating a comparison', async () => {
    mocks.startMonitoringAudit.mockResolvedValueOnce({
      ok: true,
      result: {
        auditId: 'report-1',
        status: 'QUEUED',
        reused: true,
        parentAuditId: null,
      },
    })

    const outcome = await recheckAndCompare({
      parentReportId: 'requested-parent',
      user,
      waitForCompletion: true,
    })

    expect(outcome).toMatchObject({
      parentReportId: null,
      reportId: 'report-1',
      reused: true,
      diff: null,
    })
    expect(mocks.getFlagDiffSummary).not.toHaveBeenCalled()
  })

  it('exposes no prompts or plan prompt to anonymous callers', async () => {
    const outcome = await checkAndPlan({
      url: 'https://example.com',
      userId: null,
      waitForCompletion: true,
    })

    expect(outcome.status).toBe('COMPLETED')
    const prompts = outcome.fixList?.items
      .map((item) => item.fixPrompt)
      .filter((prompt): prompt is string => Boolean(prompt))
    expect(prompts).toHaveLength(0)
    expect(outcome.fixList?.planPrompt).toBe('')
    expect(outcome.finishPlan?.items.every((item) => item.fixPrompt === null)).toBe(true)
    expect(outcome.finishPlan?.planPrompt).toBe('')
  })

  it('surfaces failedModules on the completed outcome', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      ...completedAudit(),
      failedModules: ['layout', 'accessibility'],
    })
    const outcome = await checkAndPlan({
      url: 'https://example.com',
      userId: 'user-1',
      waitForCompletion: true,
    })
    expect(outcome.failedModules).toEqual(['layout', 'accessibility'])
  })
})
