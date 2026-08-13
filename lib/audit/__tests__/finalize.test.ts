import { describe, it, vi, beforeEach, afterEach } from 'vitest'
import assert from 'node:assert/strict'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  auditFindUnique: vi.fn(),
  auditUpdate: vi.fn(),
  auditUpdateMany: vi.fn(),
  persistAuditRunCost: vi.fn(),
  diffFlagsAgainstParent: vi.fn(),
  materializeAttentionForAudit: vi.fn(),
  reconcileImprovementVerification: vi.fn(),
  logPipelineEvent: vi.fn(),
  incrementUsageOnCompleteForAudit: vi.fn(),
  upsertLeadFromAudit: vi.fn(),
  persistAuditGraphSnapshot: vi.fn(),
  triageDegradedVerdict: vi.fn(),
  triageFailureCode: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    audit: {
      findUnique: mocks.auditFindUnique,
      update: mocks.auditUpdate,
      updateMany: mocks.auditUpdateMany,
    },
  },
}))

vi.mock('@/lib/billing/costs', () => ({
  persistAuditRunCost: mocks.persistAuditRunCost,
}))

vi.mock('@/lib/audit/diff-flags', () => ({
  diffFlagsAgainstParent: mocks.diffFlagsAgainstParent,
}))

vi.mock('@/lib/improvements/service', () => ({
  materializeAttentionForAudit: mocks.materializeAttentionForAudit,
  reconcileImprovementVerification: mocks.reconcileImprovementVerification,
}))

vi.mock('@/lib/audit/pipeline-log', () => ({
  logPipelineEvent: mocks.logPipelineEvent,
}))

vi.mock('@/lib/audit/usage', () => ({
  incrementUsageOnCompleteForAudit: mocks.incrementUsageOnCompleteForAudit,
}))

vi.mock('@/lib/leads/upsert-from-audit', () => ({
  upsertLeadFromAudit: mocks.upsertLeadFromAudit,
}))

vi.mock('@/lib/graph/snapshot', () => ({
  persistAuditGraphSnapshot: mocks.persistAuditGraphSnapshot,
}))

vi.mock('@/lib/audit/triage-verdict', () => ({
  triageDegradedVerdict: mocks.triageDegradedVerdict,
}))

vi.mock('@/lib/audit/pipeline/triage-failure', () => ({
  triageFailureCode: mocks.triageFailureCode,
}))

import {
  persistImprovementCycle,
  persistAuditFailedModules,
  finalizeTriageAudit,
  finalizeTriageDegraded,
  finalizeAudit,
  finalizePartialAudit,
  finalizeDeterministicOnly,
  persistFailedAuditCost,
} from '../finalize'

describe('persistImprovementCycle', () => {
  beforeEach(() => resetMocks())

  it('projects a completed Review once and skips retries after a successful claim', async () => {
    mocks.auditUpdateMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 })

    await persistImprovementCycle('audit-1', 'parent-1')
    await persistImprovementCycle('audit-1', 'parent-1')

    expect(mocks.diffFlagsAgainstParent).toHaveBeenCalledTimes(1)
    expect(mocks.materializeAttentionForAudit).toHaveBeenCalledTimes(1)
    expect(mocks.reconcileImprovementVerification).toHaveBeenCalledTimes(1)
  })

  it('releases the projection claim when a durable Product projection fails', async () => {
    mocks.diffFlagsAgainstParent.mockRejectedValueOnce(new Error('projection failed'))

    await expect(persistImprovementCycle('audit-1', 'parent-1')).rejects.toThrow(
      'projection failed'
    )

    expect(mocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { improvementProjectedAt: null },
    })
  })
})

const BASE_INPUT = {
  auditId: 'audit-1',
  durationMs: 1200,
  pagespeedCalls: 2,
  usage: {
    inputTokens: 100,
    outputTokens: 50,
    model: 'gpt-4o',
    cacheReadTokens: 10,
    cacheWriteTokens: 5,
  },
  evidence: {
    desktopScreenshot: true,
    mobileScreenshot: true,
    metadata: true,
    aiAssessment: true,
    desktopPageSpeed: true,
    mobilePageSpeed: true,
  },
}

const AUDIT_ROW = {
  id: 'audit-1',
  status: 'FINALIZING',
  userId: 'user-1',
  parentId: null,
  completedAt: null,
  triageAt: null,
  aiReviewAt: null,
  verdict: null,
}

function resetMocks(): void {
  for (const fn of Object.values(mocks)) {
    fn.mockReset()
  }
  mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW })
  mocks.auditUpdate.mockResolvedValue({ id: 'audit-1' })
  mocks.auditUpdateMany.mockResolvedValue({ count: 1 })
  mocks.persistAuditRunCost.mockResolvedValue(undefined)
  mocks.diffFlagsAgainstParent.mockResolvedValue(undefined)
  mocks.materializeAttentionForAudit.mockResolvedValue(undefined)
  mocks.reconcileImprovementVerification.mockResolvedValue([])
  mocks.logPipelineEvent.mockResolvedValue(undefined)
  mocks.incrementUsageOnCompleteForAudit.mockResolvedValue(undefined)
  mocks.upsertLeadFromAudit.mockResolvedValue(undefined)
  mocks.persistAuditGraphSnapshot.mockResolvedValue(undefined)
  mocks.triageDegradedVerdict.mockReturnValue('degraded verdict')
  mocks.triageFailureCode.mockReturnValue('TRIAGE_FAILED')
}

describe('persistAuditFailedModules', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('persists a deduped sorted module list', async () => {
    await persistAuditFailedModules('audit-1', [
      { failedModules: ['nav-probes', 'form-probes'] },
      { failedModules: ['nav-probes'] },
    ])
    expect(mocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { failedModules: ['form-probes', 'nav-probes'] },
    })
  })

  it('writes JsonNull when no modules failed', async () => {
    await persistAuditFailedModules('audit-1', [{ failedModules: [] }, { failedModules: [] }])
    expect(mocks.auditUpdate).toHaveBeenCalledWith({
      where: { id: 'audit-1' },
      data: { failedModules: Prisma.JsonNull },
    })
  })
})

describe('finalizeTriageAudit', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('throws when the audit is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    await assert.rejects(() => finalizeTriageAudit(BASE_INPUT), /not found during triage finalization/)
  })

  it('returns early when triage already completed', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      ...AUDIT_ROW,
      status: 'COMPLETED',
      triageAt: new Date(),
      completedAt: new Date(),
    })
    await finalizeTriageAudit(BASE_INPUT)
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('throws when the audit is not in FINALIZING', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, status: 'CAPTURING' })
    await assert.rejects(() => finalizeTriageAudit(BASE_INPUT), /not ready to finalize triage/)
  })

  it('completes a triage audit with full evidence', async () => {
    await finalizeTriageAudit(BASE_INPUT)
    expect(mocks.persistAuditRunCost).toHaveBeenCalledWith('audit-1', {
      durationMs: 1200,
      llmInputTokens: 100,
      llmOutputTokens: 50,
      llmModel: 'gpt-4o',
      pagespeedCalls: 2,
      llmCacheReadTokens: 10,
      llmCacheWriteTokens: 5,
      phase: 'triage',
    })
    expect(mocks.incrementUsageOnCompleteForAudit).toHaveBeenCalledWith('audit-1', 'user-1')
    expect(mocks.upsertLeadFromAudit).toHaveBeenCalledWith('audit-1')
    expect(mocks.persistAuditGraphSnapshot).toHaveBeenCalledWith('audit-1')
    const update = mocks.auditUpdate.mock.calls[0][0]
    expect(update.data.status).toBe('COMPLETED')
    expect(update.data.reportCompleteness).toBe('FULL')
    expect(update.data.failureCode).toBeNull()
  })

  it('diffs flags against the parent when one exists', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, parentId: 'parent-1' })
    await finalizeTriageAudit(BASE_INPUT)
    expect(mocks.diffFlagsAgainstParent).toHaveBeenCalledWith('audit-1', 'parent-1')
  })

  it('throws when required evidence is missing', async () => {
    await assert.rejects(
      () => finalizeTriageAudit({ ...BASE_INPUT, evidence: { ...BASE_INPUT.evidence, aiAssessment: false } }),
      /Required audit evidence is incomplete/
    )
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('survives lead and graph snapshot failures', async () => {
    mocks.upsertLeadFromAudit.mockRejectedValue(new Error('lead failed'))
    mocks.persistAuditGraphSnapshot.mockRejectedValue(new Error('graph failed'))
    await finalizeTriageAudit(BASE_INPUT)
    expect(mocks.auditUpdate).toHaveBeenCalled()
  })
})

describe('finalizeTriageDegraded', () => {
  const degradedInput = {
    auditId: 'audit-1',
    durationMs: 900,
    pagespeedCalls: 1,
    usage: { inputTokens: 10, outputTokens: 5, model: 'gpt-4o-mini' },
    evidence: {
      desktopScreenshot: true,
      mobileScreenshot: false,
      metadata: true,
      desktopPageSpeed: true,
      mobilePageSpeed: false,
    },
    reason: 'deadline_exhausted' as const,
    errorMsg: 'request timeout',
  }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns silently when the audit is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    await finalizeTriageDegraded(degradedInput)
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('returns early when already completed', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      ...AUDIT_ROW,
      status: 'COMPLETED',
      completedAt: new Date(),
    })
    await finalizeTriageDegraded(degradedInput)
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('persists usage cost and writes a degraded completion', async () => {
    await finalizeTriageDegraded(degradedInput)
    expect(mocks.persistAuditRunCost).toHaveBeenCalledWith('audit-1', {
      durationMs: 900,
      llmInputTokens: 10,
      llmOutputTokens: 5,
      llmModel: 'gpt-4o-mini',
      pagespeedCalls: 1,
      phase: 'triage',
    })
    expect(mocks.triageFailureCode).toHaveBeenCalledWith('deadline_exhausted')
    expect(mocks.triageDegradedVerdict).toHaveBeenCalledWith('deadline_exhausted', true)
    const update = mocks.auditUpdate.mock.calls[0][0]
    expect(update.data.status).toBe('COMPLETED')
    expect(update.data.reportCompleteness).toBe('PARTIAL')
    expect(update.data.evidenceCoverage.aiAssessment).toBe(false)
    expect(update.data.failureCode).toBe('TRIAGE_FAILED')
    expect(update.data.failureStage).toBe('judging')
  })

  it('writes zero cost when no usage is provided', async () => {
    const { usage: _usage, ...rest } = degradedInput
    void _usage
    await finalizeTriageDegraded(rest)
    expect(mocks.persistAuditRunCost).toHaveBeenCalledWith('audit-1', {
      durationMs: 900,
      llmInputTokens: 0,
      llmOutputTokens: 0,
      llmModel: 'none',
      pagespeedCalls: 1,
    })
  })

  it('diffs against parent and increments usage for signed-up users', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, parentId: 'parent-1' })
    await finalizeTriageDegraded(degradedInput)
    expect(mocks.diffFlagsAgainstParent).toHaveBeenCalledWith('audit-1', 'parent-1')
    expect(mocks.incrementUsageOnCompleteForAudit).toHaveBeenCalledWith('audit-1', 'user-1')
  })
})

describe('finalizeAudit', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('throws when the audit is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    await assert.rejects(() => finalizeAudit(BASE_INPUT), /not found during finalization/)
  })

  it('returns early when fully completed with AI review', async () => {
    mocks.auditFindUnique.mockResolvedValue({
      ...AUDIT_ROW,
      status: 'COMPLETED',
      completedAt: new Date(),
      aiReviewAt: new Date(),
    })
    await finalizeAudit(BASE_INPUT)
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('throws when the audit is not FINALIZING or JUDGING', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, status: 'CHECKING' })
    await assert.rejects(() => finalizeAudit(BASE_INPUT), /not ready to finalize prescription/)
  })

  it('finalizes a JUDGING audit with prescription phase cost', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, status: 'JUDGING' })
    await finalizeAudit(BASE_INPUT)
    expect(mocks.persistAuditRunCost).toHaveBeenCalledWith('audit-1', {
      durationMs: 1200,
      llmInputTokens: 100,
      llmOutputTokens: 50,
      llmModel: 'gpt-4o',
      pagespeedCalls: 2,
      llmCacheReadTokens: 10,
      llmCacheWriteTokens: 5,
      phase: 'prescription',
    })
    const update = mocks.auditUpdate.mock.calls[0][0]
    expect(update.data.reportCompleteness).toBe('FULL')
    expect(update.data.aiReviewAt).toBeInstanceOf(Date)
    expect(mocks.incrementUsageOnCompleteForAudit).toHaveBeenCalledWith('audit-1', 'user-1')
  })

  it('skips usage increment when the audit has no user', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, userId: null })
    await finalizeAudit(BASE_INPUT)
    expect(mocks.incrementUsageOnCompleteForAudit).not.toHaveBeenCalled()
    expect(mocks.auditUpdate).toHaveBeenCalled()
  })

  it('throws on incomplete evidence', async () => {
    await assert.rejects(
      () => finalizeAudit({ ...BASE_INPUT, evidence: { ...BASE_INPUT.evidence, metadata: false } }),
      /Required audit evidence is incomplete/
    )
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })
})

describe('finalizePartialAudit', () => {
  const partialInput = {
    auditId: 'audit-1',
    durationMs: 700,
    pagespeedCalls: 1,
    usage: { inputTokens: 20, outputTokens: 10, model: 'gpt-4o-mini' },
    evidence: {
      desktopScreenshot: true,
      mobileScreenshot: true,
      metadata: true,
      desktopPageSpeed: true,
      mobilePageSpeed: true,
    },
    failureCode: 'AI_REVIEW_TIMEOUT',
    failureStage: 'ai-review',
    errorMsg: 'timed out',
  }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns silently when the audit is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    await finalizePartialAudit(partialInput)
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('writes a partial completion with the stub verdict', async () => {
    await finalizePartialAudit(partialInput)
    expect(mocks.persistAuditRunCost).toHaveBeenCalled()
    const update = mocks.auditUpdate.mock.calls[0][0]
    expect(update.data.status).toBe('COMPLETED')
    expect(update.data.reportCompleteness).toBe('PARTIAL')
    expect(update.data.failureCode).toBe('AI_REVIEW_TIMEOUT')
    expect(update.data.failureStage).toBe('ai-review')
    expect(update.data.verdict).toContain('AI summary unavailable')
  })

  it('keeps an existing verdict', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, verdict: 'existing verdict text' })
    await finalizePartialAudit(partialInput)
    expect(mocks.auditUpdate.mock.calls[0][0].data.verdict).toBe('existing verdict text')
  })

  it('skips cost persistence when no usage tokens', async () => {
    const { usage: _u, ...rest } = partialInput
    void _u
    await finalizePartialAudit(rest)
    expect(mocks.persistAuditRunCost).not.toHaveBeenCalled()
  })

  it('diffs flags against the parent', async () => {
    mocks.auditFindUnique.mockResolvedValue({ ...AUDIT_ROW, parentId: 'parent-1' })
    await finalizePartialAudit(partialInput)
    expect(mocks.diffFlagsAgainstParent).toHaveBeenCalledWith('audit-1', 'parent-1')
  })
})

describe('finalizeDeterministicOnly', () => {
  const detInput = {
    auditId: 'audit-1',
    durationMs: 500,
    pagespeedCalls: 1,
    evidence: {
      desktopScreenshot: true,
      mobileScreenshot: true,
      metadata: true,
      desktopPageSpeed: true,
      mobilePageSpeed: true,
    },
  }

  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('returns silently when the audit is missing', async () => {
    mocks.auditFindUnique.mockResolvedValue(null)
    await finalizeDeterministicOnly(detInput)
    expect(mocks.auditUpdate).not.toHaveBeenCalled()
  })

  it('completes with a deterministic verdict and full completeness', async () => {
    await finalizeDeterministicOnly(detInput)
    const update = mocks.auditUpdate.mock.calls[0][0]
    expect(update.data.status).toBe('COMPLETED')
    expect(update.data.reportCompleteness).toBe('FULL')
    expect(update.data.verdict).toContain('Deterministic scan')
    expect(update.data.evidenceCoverage.aiAssessment).toBe(false)
    expect(mocks.persistAuditGraphSnapshot).toHaveBeenCalledWith('audit-1')
  })

  it('marks partial completeness when screenshots or metadata are missing', async () => {
    await finalizeDeterministicOnly({
      ...detInput,
      evidence: { ...detInput.evidence, desktopScreenshot: false },
    })
    expect(mocks.auditUpdate.mock.calls[0][0].data.reportCompleteness).toBe('PARTIAL')
  })
})

describe('persistFailedAuditCost', () => {
  beforeEach(() => resetMocks())
  afterEach(() => vi.restoreAllMocks())

  it('does nothing without usage', async () => {
    await persistFailedAuditCost('audit-1', 100, 1)
    expect(mocks.persistAuditRunCost).not.toHaveBeenCalled()
  })

  it('does nothing with zero tokens', async () => {
    await persistFailedAuditCost('audit-1', 100, 1, { inputTokens: 0, outputTokens: 0, model: 'gpt-4o' })
    expect(mocks.persistAuditRunCost).not.toHaveBeenCalled()
  })

  it('persists cost when tokens were consumed', async () => {
    await persistFailedAuditCost('audit-1', 100, 1, { inputTokens: 30, outputTokens: 10, model: 'gpt-4o' })
    expect(mocks.persistAuditRunCost).toHaveBeenCalledWith('audit-1', {
      durationMs: 100,
      llmInputTokens: 30,
      llmOutputTokens: 10,
      llmModel: 'gpt-4o',
      pagespeedCalls: 1,
    })
  })
})

import { expect } from 'vitest'
void expect
