import assert from 'node:assert/strict'
import { describe, it, vi, beforeEach, expect } from 'vitest'
import type { PipelineContext, PageRun } from '../types'

const { prismaMock, logPipelineEvent, persistTriageResults, tryResolveEvidenceAnchorsForAudit, mergeFlowCtaEvidenceAnchors, tryCaptureVisualEvidenceForAudit, finalizeTriageAudit, finalizeTriageDegraded, persistAuditFailedModules, enqueueAiReview, runTriageStep, accumulateTriageUsage, averageScores, buildCombinedTriageOutput, primaryPageRun, resolveAuditOutcome, parseTriageFailure } =
  vi.hoisted(() => {
    return {
      prismaMock: {
        flag: { findMany: vi.fn(async () => []) },
        audit: { findUnique: vi.fn() },
      },
      logPipelineEvent: vi.fn(async () => {}),
      persistTriageResults: vi.fn(async () => {}),
      tryResolveEvidenceAnchorsForAudit: vi.fn(async () => {}),
      mergeFlowCtaEvidenceAnchors: vi.fn(async () => {}),
      tryCaptureVisualEvidenceForAudit: vi.fn(async () => {}),
      finalizeTriageAudit: vi.fn(async () => {}),
      finalizeTriageDegraded: vi.fn(async () => {}),
      persistAuditFailedModules: vi.fn(async () => {}),
      enqueueAiReview: vi.fn(async () => {}),
      runTriageStep: vi.fn(),
      accumulateTriageUsage: vi.fn(),
      averageScores: vi.fn(() => ({})),
      buildCombinedTriageOutput: vi.fn(() => ({ combined: true })),
      primaryPageRun: vi.fn(),
      resolveAuditOutcome: vi.fn(),
      parseTriageFailure: vi.fn(() => ({ reason: 'unknown', message: 'x', retryable: false })),
    }
  })

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/pipeline-log', () => ({ logPipelineEvent }))
vi.mock('@/lib/audit/persist', () => ({ persistTriageResults }))
vi.mock('@/lib/audit/persist-evidence-anchors', () => ({
  tryResolveEvidenceAnchorsForAudit,
  mergeFlowCtaEvidenceAnchors,
}))
vi.mock('@/lib/audit/persist-visual-evidence', () => ({
  tryCaptureVisualEvidenceForAudit,
}))
vi.mock('@/lib/audit/finalize', () => ({
  finalizeTriageAudit,
  finalizeTriageDegraded,
  persistAuditFailedModules,
}))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ enqueueAiReview }))
vi.mock('@/lib/audit/pipeline/triage-step', () => ({ runTriageStep }))
vi.mock('@/lib/audit/pipeline/context', () => ({ accumulateTriageUsage }))
vi.mock('@/lib/audit/pipeline/combine-pages', () => ({
  averageScores,
  productScoresFromFlags: averageScores,
  collapsedPageFlags: vi.fn(() => []),
  buildCombinedTriageOutput,
}))
vi.mock('@/lib/audit/pipeline/outcome', () => ({
  primaryPageRun,
  resolveAuditOutcome,
}))
vi.mock('@/lib/audit/pipeline/triage-failure', () => ({ parseTriageFailure }))

import { retryPrimaryTriage, finalizeFromOutcome } from '../finalize-from-outcome'

function ctx(): PipelineContext {
  return {
    auditId: 'audit-1',
    deadline: 0,
    startedAt: new Date(),
    pagespeedCalls: 2,
    usage: {
      inputTokens: 100,
      outputTokens: 50,
      models: ['gpt-4o'],
      cacheReadTokens: 10,
      cacheWriteTokens: 5,
    },
    includeAi: true,
  }
}

function pageRun(overrides: Partial<PageRun> = {}): PageRun {
  return {
    pageId: 'primary',
    url: 'https://example.com/',
    metadata: { title: 'Example', links: [] } as unknown as PageRun['metadata'],
    desktop: null,
    mobile: null,
    desktopScreenshot: true,
    mobileScreenshot: true,
    flowScan: true,
    desktopBase64: 'base64',
    mobileBase64: null,
    flags: [],
    failedModules: [],
    detectedTech: [],
    industryGuess: null,
    ...overrides,
  }
}

describe('retryPrimaryTriage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    primaryPageRun.mockImplementation((runs: PageRun[]) => runs[0] ?? null)
    runTriageStep.mockReset()
    accumulateTriageUsage.mockReset()
  })

  it('does nothing when there is no primary page', async () => {
    primaryPageRun.mockReturnValue(null)
    const runs = [pageRun()]
    const result = await retryPrimaryTriage(ctx(), runs)
    assert.equal(result, runs)
    expect(runTriageStep).not.toHaveBeenCalled()
  })

  it('does nothing when the primary page already has triage', async () => {
    const runs = [pageRun({ triage: {} as PageRun['triage'] })]
    const result = await retryPrimaryTriage(ctx(), runs)
    assert.equal(result, runs)
    expect(runTriageStep).not.toHaveBeenCalled()
  })

  it('does nothing when the failure is not retryable', async () => {
    const runs = [pageRun({ triageFailure: { reason: 'contract_invalid', message: 'x', retryable: false } })]
    const result = await retryPrimaryTriage(ctx(), runs)
    assert.equal(result, runs)
    expect(runTriageStep).not.toHaveBeenCalled()
  })

  it('retries triage and replaces the primary run on success', async () => {
    runTriageStep.mockResolvedValue({
      output: { newFlags: [{ checkId: 'a' }] },
      usage: { inputTokens: 1, outputTokens: 1 },
    })
    accumulateTriageUsage.mockImplementation(() => {})
    const runs = [pageRun({ triageFailure: { reason: 'provider_exhausted', message: 'x', retryable: true } })]
    const result = await retryPrimaryTriage(ctx(), runs)
    expect(runTriageStep).toHaveBeenCalled()
    assert.equal(result.length, 1)
    assert.equal(result[0].triageFailure, undefined)
    assert.equal(result[0].triage?.output.newFlags[0].pageUrl, 'https://example.com/')
    expect(accumulateTriageUsage).toHaveBeenCalled()
  })

  it('records the new failure when the retry fails', async () => {
    runTriageStep.mockRejectedValue(new Error('rate limit again'))
    parseTriageFailure.mockReturnValue({ reason: 'provider_exhausted', message: 'rate limit again', retryable: true })
    const runs = [pageRun({ triageFailure: { reason: 'provider_exhausted', message: 'x', retryable: true } })]
    const result = await retryPrimaryTriage(ctx(), runs)
    assert.equal(result[0].triageFailure?.reason, 'provider_exhausted')
    expect(logPipelineEvent).toHaveBeenCalledWith('audit-1', expect.objectContaining({ event: 'triage_runner_retry_failed' }))
  })
})

describe('finalizeFromOutcome', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.audit.findUnique.mockResolvedValue({ includeAi: true, aiReviewAt: null })
    prismaMock.flag.findMany.mockResolvedValue([])
  })

  it('finalizes a complete triage and enqueues the AI review when claimed', async () => {
    resolveAuditOutcome.mockReturnValue({
      kind: 'triage_complete',
      pageRuns: [pageRun()],
    })
    const ok = await finalizeFromOutcome({
      ctx: ctx(),
      auditId: 'audit-1',
      auditUrl: 'https://example.com/',
      pageRuns: [pageRun()],
      startedAt: new Date(),
    })
    assert.equal(ok, true)
    expect(persistTriageResults).toHaveBeenCalled()
    expect(finalizeTriageAudit).toHaveBeenCalled()
    expect(enqueueAiReview).toHaveBeenCalledWith('audit-1')
    expect(persistAuditFailedModules).toHaveBeenCalled()
  })

  it('skips the AI review enqueue when includeAi is false', async () => {
    resolveAuditOutcome.mockReturnValue({
      kind: 'triage_complete',
      pageRuns: [pageRun()],
    })
    prismaMock.audit.findUnique.mockResolvedValue({ includeAi: false, aiReviewAt: null })
    await finalizeFromOutcome({
      ctx: ctx(),
      auditId: 'audit-1',
      auditUrl: 'https://example.com/',
      pageRuns: [pageRun()],
      startedAt: new Date(),
    })
    expect(enqueueAiReview).not.toHaveBeenCalled()
  })

  it('skips the AI review enqueue when the review already ran', async () => {
    resolveAuditOutcome.mockReturnValue({
      kind: 'triage_complete',
      pageRuns: [pageRun()],
    })
    prismaMock.audit.findUnique.mockResolvedValue({ includeAi: true, aiReviewAt: new Date() })
    await finalizeFromOutcome({
      ctx: ctx(),
      auditId: 'audit-1',
      auditUrl: 'https://example.com/',
      pageRuns: [pageRun()],
      startedAt: new Date(),
    })
    expect(enqueueAiReview).not.toHaveBeenCalled()
  })

  it('falls back to the degraded path and returns false when persistence fails', async () => {
    resolveAuditOutcome.mockReturnValue({
      kind: 'triage_complete',
      pageRuns: [pageRun()],
    })
    persistTriageResults.mockRejectedValue(new Error('db down'))
    const ok = await finalizeFromOutcome({
      ctx: ctx(),
      auditId: 'audit-1',
      auditUrl: 'https://example.com/',
      pageRuns: [pageRun()],
      startedAt: new Date(),
    })
    assert.equal(ok, false)
    expect(logPipelineEvent).toHaveBeenCalledWith('audit-1', expect.objectContaining({ event: 'triage_persist_failed' }))
    expect(finalizeTriageDegraded).toHaveBeenCalled()
  })

  it('finalizes a degraded outcome directly', async () => {
    resolveAuditOutcome.mockReturnValue({
      kind: 'triage_degraded',
      pageRuns: [pageRun()],
      reason: 'no_provider_keys',
      message: 'no keys',
    })
    const ok = await finalizeFromOutcome({
      ctx: ctx(),
      auditId: 'audit-1',
      auditUrl: 'https://example.com/',
      pageRuns: [pageRun()],
      startedAt: new Date(),
    })
    assert.equal(ok, true)
    expect(finalizeTriageDegraded).toHaveBeenCalledWith(
      expect.objectContaining({ reason: 'no_provider_keys' })
    )
    expect(persistTriageResults).not.toHaveBeenCalled()
  })

  it('merges journey evidence anchors from the primary flow result', async () => {
    const flow = { events: [] } as unknown as PageRun['flowResult']
    resolveAuditOutcome.mockReturnValue({
      kind: 'triage_complete',
      pageRuns: [pageRun({ flowResult: flow })],
    })
    prismaMock.flag.findMany.mockResolvedValue([
      { checkId: 'j1', problem: 'p', evidence: 'e', severity: 'IMPORTANT', rubric: 'EXPERIENCE' },
    ] as never[])
    await finalizeFromOutcome({
      ctx: ctx(),
      auditId: 'audit-1',
      auditUrl: 'https://example.com/',
      pageRuns: [pageRun({ flowResult: flow })],
      startedAt: new Date(),
    })
    expect(mergeFlowCtaEvidenceAnchors).toHaveBeenCalledWith('audit-1', flow)
  })
})
