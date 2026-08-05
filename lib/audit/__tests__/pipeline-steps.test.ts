import { describe, it, expect, vi, beforeEach } from 'vitest'
import { AuditDeadlineError } from '../pipeline-errors'
import { healthyMeta } from './check-fixtures'

// ── runTriageStep mocks ──────────────────────────────────────────

vi.mock('../judge-triage', () => ({
  runTriageWithRetry: vi.fn(),
}))

vi.mock('../pipeline-log', () => ({
  logPipelineEvent: vi.fn(),
}))

import { runTriageWithRetry } from '../judge-triage'
import { logPipelineEvent } from '../pipeline-log'
import { runTriageStep } from '../pipeline/triage-step'

// ── tryPartialFinalize mocks ─────────────────────────────────────

vi.mock('../finalize', () => ({
  finalizePartialAudit: vi.fn(),
  persistAuditFailedModules: vi.fn(),
}))

vi.mock('../pipeline/failure', () => ({
  deriveAuditFailure: vi.fn(),
}))

import { finalizePartialAudit, persistAuditFailedModules } from '../finalize'
import { deriveAuditFailure } from '../pipeline/failure'
import { tryPartialFinalize, accumulateTriageUsage } from '../pipeline/context'
import type { PipelineContext, PageRun } from '../pipeline/types'

// ── Helpers ──────────────────────────────────────────────────────

const BASE_CTX: PipelineContext = {
  auditId: 'test-audit',
  deadline: Date.now() + 60_000,
  startedAt: new Date(),
  pagespeedCalls: 0,
  usage: { inputTokens: 0, outputTokens: 0, models: [] },
  includeAi: true,
}

function ctx(overrides?: Partial<PipelineContext>): PipelineContext {
  return {
    ...BASE_CTX,
    usage: { inputTokens: 0, outputTokens: 0, models: [] },
    ...overrides,
  }
}

function stubPageRun(overrides?: Partial<PageRun>): PageRun {
  return {
    pageId: 'p1',
    url: 'https://example.com',
    metadata: healthyMeta(),
    desktop: null,
    mobile: null,
    desktopScreenshot: true,
    mobileScreenshot: true,
    flowScan: false,
    failedModules: [],
    desktopBase64: 'img',
    mobileBase64: null,
    flags: [],
    detectedTech: [],
    industryGuess: null,
    ...overrides,
  }
}

describe('runTriageStep', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls runTriageWithRetry with the input and returns its result', async () => {
    const mockResult = { output: { verdict: 'ok' }, usage: { inputTokens: 10, outputTokens: 5, model: 'claude' } }
    vi.mocked(runTriageWithRetry).mockResolvedValue(mockResult as never)

    const input = {
      url: 'https://example.com',
      metadata: healthyMeta(),
      desktop: null,
      mobile: null,
      flags: [],
      desktopBase64: 'img',
      mobileBase64: null,
    }

    const result = await runTriageStep(ctx(), input)

    expect(runTriageWithRetry).toHaveBeenCalledWith(
      input.url,
      input.metadata,
      input.desktop,
      input.mobile,
      input.flags,
      input.desktopBase64,
      input.mobileBase64,
      expect.any(Number),
    )
    expect(result).toBe(mockResult)
  })

  it('throws AuditDeadlineError when deadline has passed', async () => {
    await expect(runTriageStep(ctx({ deadline: Date.now() - 1 }), {} as never)).rejects.toThrow(AuditDeadlineError)
  })

  it('throws AuditDeadlineError when budget is below MIN_JUDGE_BUDGET_MS', async () => {
    const withinDeadline = Date.now() + 10_000 // 10s remaining < 25s min budget
    await expect(runTriageStep(ctx({ deadline: withinDeadline }), {} as never)).rejects.toThrow(AuditDeadlineError)
  })

  it('logs triage_started and triage_completed events', async () => {
    vi.mocked(runTriageWithRetry).mockResolvedValue({ output: {}, usage: { inputTokens: 0, outputTokens: 0, model: 'gpt' } } as never)

    await runTriageStep(ctx(), {
      url: 'https://example.com',
      metadata: healthyMeta(),
      desktop: null,
      mobile: null,
      flags: [],
      desktopBase64: 'img',
      mobileBase64: null,
    })

    expect(logPipelineEvent).toHaveBeenCalledWith('test-audit', { stage: 'judging', event: 'triage_started' })
    expect(logPipelineEvent).toHaveBeenCalledWith('test-audit', expect.objectContaining({ stage: 'judging', event: 'triage_completed', durationMs: expect.any(Number) }))
  })
})

describe('accumulateTriageUsage', () => {
  it('adds input and output tokens to the context', () => {
    const c = ctx()
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 100, outputTokens: 50, model: 'claude' } })
    expect(c.usage.inputTokens).toBe(100)
    expect(c.usage.outputTokens).toBe(50)
  })

  it('accumulates across multiple calls', () => {
    const c = ctx()
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 10, outputTokens: 5, model: 'claude' } })
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 20, outputTokens: 15, model: 'claude' } })
    expect(c.usage.inputTokens).toBe(30)
    expect(c.usage.outputTokens).toBe(20)
  })

  it('adds unique model to the models array', () => {
    const c = ctx()
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 'claude' } })
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 'gpt' } })
    expect(c.usage.models).toEqual(['claude', 'gpt'])
  })

  it('does not duplicate an existing model', () => {
    const c = ctx()
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 'claude' } })
    accumulateTriageUsage(c, { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 'claude' } })
    expect(c.usage.models).toEqual(['claude'])
  })
})

describe('tryPartialFinalize', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(finalizePartialAudit).mockResolvedValue(undefined)
    vi.mocked(deriveAuditFailure).mockReturnValue({ failureCode: 'AUDIT_TIMEOUT', failureStage: 'judging' })
  })

  it('returns false when pageRuns is empty', async () => {
    const result = await tryPartialFinalize(ctx(), [], new Error('boom'))
    expect(result).toBe(false)
    expect(finalizePartialAudit).not.toHaveBeenCalled()
  })

  it('returns false when any page lacks a desktop screenshot', async () => {
    const pages = [stubPageRun({ desktopScreenshot: true }), stubPageRun({ desktopScreenshot: false })]
    const result = await tryPartialFinalize(ctx(), pages, new Error('boom'))
    expect(result).toBe(false)
    expect(finalizePartialAudit).not.toHaveBeenCalled()
  })

  it('calls finalizePartialAudit with correct args and returns true', async () => {
    const c = ctx({ pagespeedCalls: 3 })
    c.usage.inputTokens = 100
    c.usage.outputTokens = 50
    c.usage.models = ['claude']

    const pages = [stubPageRun(), stubPageRun()]
    const error = new Error('LLM timeout')

    const result = await tryPartialFinalize(c, pages, error)

    expect(result).toBe(true)
    expect(finalizePartialAudit).toHaveBeenCalledWith({
      auditId: 'test-audit',
      durationMs: expect.any(Number),
      pagespeedCalls: 3,
      usage: { inputTokens: 100, outputTokens: 50, model: 'claude' },
      evidence: {
        desktopScreenshot: true,
        mobileScreenshot: true,
        metadata: true,
        desktopPageSpeed: false,
        mobilePageSpeed: false,
      },
      failureCode: 'AUDIT_TIMEOUT',
      failureStage: 'judging',
      errorMsg: 'LLM timeout',
    })
  })

  it('passes "judging" as fallback stage when any page has triage', async () => {
    const pages = [stubPageRun({ triage: { output: {} as never, usage: { inputTokens: 0, outputTokens: 0, model: 't' } } })]
    await tryPartialFinalize(ctx(), pages, new Error('err'))
    expect(deriveAuditFailure).toHaveBeenCalledWith(expect.any(Error), 'judging')
  })

  it('passes "checking" as fallback stage when no page has triage', async () => {
    const pages = [stubPageRun()]
    await tryPartialFinalize(ctx(), pages, new Error('err'))
    expect(deriveAuditFailure).toHaveBeenCalledWith(expect.any(Error), 'checking')
  })

  it('sanitizes the error message', async () => {
    const pages = [stubPageRun()]
    await tryPartialFinalize(ctx(), pages, new Error('Error at https://example.com: ANTHROPIC_API_KEY is bad'))
    expect(finalizePartialAudit).toHaveBeenCalledWith(expect.objectContaining({
      errorMsg: 'Error at [url] [config] is bad',
    }))
  })

  it('persists the union of failed check modules before finalizing', async () => {
    const pages = [
      stubPageRun({ failedModules: ['content'] }),
      stubPageRun({ failedModules: ['seo', 'content'] }),
    ]
    const result = await tryPartialFinalize(ctx(), pages, new Error('boom'))
    expect(result).toBe(true)
    expect(persistAuditFailedModules).toHaveBeenCalledWith('test-audit', pages)
  })

  it('handles non-Error thrown values', async () => {
    const pages = [stubPageRun()]
    await tryPartialFinalize(ctx(), pages, 'string error')
    expect(finalizePartialAudit).toHaveBeenCalledWith(expect.objectContaining({
      errorMsg: 'string error',
    }))
  })
})
