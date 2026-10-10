import { describe, it, vi, expect, beforeEach, type Mock } from 'vitest'

const { prismaMock, captureMock, slowReplayMock } = vi.hoisted(() => ({
  prismaMock: {
    audit: { findUnique: vi.fn(), update: vi.fn() },
    auditPage: {
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    screenshot: { create: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (Array.isArray(arg)) return Promise.all(arg)
      return arg
    }),
  },
  captureMock: vi.fn(),
  slowReplayMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/audit/screenshot', () => ({
  captureScreenshots: captureMock,
  getAuditBrowser: vi.fn(async () => ({})),
}))
vi.mock('@/lib/audit/flow/slow-replay-probe', () => ({
  runSlowReplay: slowReplayMock,
}))
vi.mock('@/lib/audit/pagespeed', () => ({
  fetchPageSpeedData: vi.fn(async () => ({
    desktop: { score: 90, strategy: 'desktop' },
    mobile: { score: 85, strategy: 'mobile' },
  })),
  toStoredPageSpeedResult: vi.fn((value: unknown) => value),
}))
vi.mock('@/lib/audit/checks', () => ({
  runAllChecks: vi.fn(async () => ({ flags: [], failedModules: [], executions: [] })),
  computeRubricScores: vi.fn(() => ({})),
  suppressOverlappingFlags: vi.fn((flags: unknown[]) => flags),
}))
vi.mock('@/lib/audit/checks/flow', () => ({ runFlowChecks: vi.fn(() => []) }))
vi.mock('@/lib/audit/browser/page-session', () => ({
  createAuditPage: vi.fn(async () => ({
    page: {
      close: vi.fn(async () => undefined),
      context: () => ({ close: vi.fn(async () => undefined) }),
    },
    networkFailures: [],
    formProbe: null,
    disposeNetwork: vi.fn(),
  })),
}))
vi.mock('@/lib/audit/flow/run-flow-scan', () => ({
  runFlowScan: vi.fn(async () => ({
    status: 'success',
    steps: [],
    finalUrl: 'https://example.com/',
  })),
}))
vi.mock('@/lib/audit/checks/slow-replay', () => ({
  runSlowReplayChecks: vi.fn(() => [
    {
      checkId: 'slow-3g-blank-screen',
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      problem: 'test',
      evidence: 'test',
      fix: 'test',
      confidence: 1,
      source: 'DETERMINISTIC',
    },
  ]),
}))
vi.mock('@/lib/improvements/verifier-provenance', () => ({
  recordTargetedPageVerifierExecutions: vi.fn(async () => 0),
}))
vi.mock('@/lib/audit/persist', () => ({ persistDeterministicFlags: vi.fn() }))
vi.mock('@/lib/audit/pipeline/triage-step', () => ({ runTriageStep: vi.fn() }))
vi.mock('@/lib/audit/judge-triage', () => ({
  isTriageProviderConfigured: vi.fn(() => false),
}))
vi.mock('@/lib/audit/product-contract', () => ({
  inferProductContract: vi.fn(() => ({ source: 'heuristic' })),
}))
vi.mock('@/lib/audit/product-intelligence', () => ({
  mergeHeuristicIntoProjectPi: vi.fn(),
  productIntelligenceFromContract: vi.fn(),
  resolveContractForCapture: vi.fn((inferred: unknown) => inferred),
}))
vi.mock('@/lib/audit/ensure-product-project', () => ({
  loadProjectIntelligence: vi.fn(async () => null),
  mutateProjectIntelligence: vi.fn(),
}))
vi.mock('@/lib/audit/tech-detect', () => ({
  detectTechnologies: vi.fn(() => []),
  inferIndustry: vi.fn(() => null),
}))
vi.mock('@/lib/audit/technology-profile', () => ({
  persistTechnologyObservations: vi.fn(),
}))
vi.mock('@/lib/audit/metadata', () => ({
  parseMetadataFromHtml: vi.fn(() => ({ title: 'Test', pageText: 'hello' })),
  mergeRuntimeHeadMetadata: vi.fn((meta: unknown) => meta),
  trimMetadataForStorage: vi.fn((meta: unknown) => meta),
  fetchAndParseMetadata: vi.fn(async () => ({ title: 'Test', pageText: 'hello' })),
}))

import { runPage } from '@/lib/audit/pipeline/run-page'
import { runSlowReplayChecks } from '@/lib/audit/checks/slow-replay'
import { recordTargetedPageVerifierExecutions } from '@/lib/improvements/verifier-provenance'
import { createAuditPage } from '@/lib/audit/browser/page-session'
import { runFlowScan } from '@/lib/audit/flow/run-flow-scan'
import { captureScreenshots } from '@/lib/audit/screenshot'
import type { PipelineContext } from '@/lib/audit/pipeline/types'
import { systemClock } from '@/lib/time/clock'

function pipelineContext(deadlineMs = 120_000): PipelineContext {
  const startedAt = systemClock.now()
  return {
    auditId: 'audit-1',
    deadline: startedAt.getTime() + deadlineMs,
    startedAt,
    clock: systemClock,
    trace: { executionId: 'audit-1:1', traceId: 'trace-test', attempt: 1 },
    events: { log: vi.fn(async () => undefined) },
    pagespeedCalls: 0,
    usage: { inputTokens: 0, outputTokens: 0, models: [] },
    includeAi: false,
  }
}

describe('runPage production capture path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(runFlowScan).mockResolvedValue({ status: 'success', steps: [], finalUrl: 'https://example.com/' })
    vi.mocked(createAuditPage).mockResolvedValue({
      page: { context: () => ({ close: vi.fn(async () => undefined) }) },
      disposeNetwork: vi.fn(), networkFailures: [], formProbe: null,
    } as never)
    prismaMock.auditPage.create.mockResolvedValue({ id: 'page-1' })
    prismaMock.auditPage.update.mockResolvedValue({})
    prismaMock.audit.findUnique.mockResolvedValue({ projectId: null, userId: 'user-1', parentId: null })
    captureMock.mockResolvedValue({
      desktopUrl: 'https://cdn/desktop.png',
      mobileUrl: 'https://cdn/mobile.png',
      desktopBase64: 'abc',
      mobileBase64: 'def',
      desktopHtml: '<html></html>',
      consoleErrors: [],
      captureStatus: { desktop: 'ok', mobile: 'ok' },
      captureFailures: [],
      flowResult: null,
      networkFailures: [],
      actionTimeline: [],
      formProbe: null,
    })
    slowReplayMock.mockResolvedValue({
      timeToFirstTextMs: 6000,
      timeToCtaMs: 1000,
      screenshotUrls: [],
    })
  })

  it('runs slow replay on the primary page and merges slow-replay flags', async () => {
    const ctx = pipelineContext()

    const result = await runPage(ctx, {
      url: 'https://example.com',
      position: 0,
      role: 'primary',
      primary: true,
    })

    expect(slowReplayMock).toHaveBeenCalledWith(expect.anything(), 'audit-1', 'https://example.com/')
    expect(runSlowReplayChecks).toHaveBeenCalled()
    expect(result.flags.some((flag) => flag.checkId === 'slow-3g-blank-screen')).toBe(true)
    expect((ctx.events.log as Mock).mock.calls.some((call) => call[0]?.event === 'slow_replay_completed')).toBe(
      true
    )
  })

  it('defers the flow walk: capture runs without flow, flow runs after checks when budget allows', async () => {
    const ctx = pipelineContext()

    await runPage(ctx, {
      url: 'https://example.com',
      position: 0,
      role: 'primary',
      primary: true,
    })

    const captureOptions = (captureScreenshots as Mock).mock.calls[0][3] as {
      runFlow?: boolean
    }
    expect(captureOptions.runFlow).toBe(false)
  })

  it('walks the primary page for an anonymous teaser scan and still skips slow replay', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      projectId: null,
      userId: null,
      parentId: null,
    })
    const ctx = pipelineContext()

    const result = await runPage(ctx, {
      url: 'https://example.com',
      position: 0,
      role: 'primary',
      primary: true,
    })

    const captureOptions = (captureScreenshots as Mock).mock.calls[0][3] as {
      runFlow?: boolean
    }
    expect(captureOptions.runFlow).toBe(false)
    expect(slowReplayMock).not.toHaveBeenCalled()
    expect(runSlowReplayChecks).not.toHaveBeenCalled()
    expect(runFlowScan).toHaveBeenCalled()
    expect(result.flowScan).toBe(true)
    expect(
      (ctx.events.log as Mock).mock.calls.some((call) => call[0]?.event === 'slow_replay_skipped_teaser')
    ).toBe(true)
    expect(
      (ctx.events.log as Mock).mock.calls.some((call) => call[0]?.event === 'flow_skipped_teaser')
    ).toBe(false)
    expect(
      (ctx.events.log as Mock).mock.calls.some((call) => call[0]?.event === 'flow_completed_deferred')
    ).toBe(true)
    // The reduced pipeline still streams: checks-start progress anchor is written.
    expect(
      prismaMock.audit.update.mock.calls.some(
        (call: unknown[]) => (call[0] as { data?: { progress?: number } }).data?.progress === 42
      )
    ).toBe(true)
  })

  it('skips slow replay when the audit deadline is too tight', async () => {
    const ctx = pipelineContext(5_000)

    await runPage(ctx, {
      url: 'https://example.com',
      position: 0,
      role: 'primary',
      primary: true,
    })

    expect(slowReplayMock).not.toHaveBeenCalled()
    expect((ctx.events.log as Mock).mock.calls.some((call) => call[0]?.event === 'slow_replay_skipped_deadline')).toBe(
      true
    )
  })

  it('retains deferred engagement failures, persists flow, and records verification after the walk', async () => {
    const failure = { url: 'https://example.com/api/signup', method: 'POST', status: 500,
      resourceType: 'fetch', sameOrigin: true, engagementPath: true, at: Date.now() }
    const close = vi.fn(async () => undefined)
    const disposeNetwork = vi.fn()
    vi.mocked(createAuditPage).mockResolvedValue({
      page: { context: () => ({ close }) }, disposeNetwork,
      networkFailures: [failure], formProbe: { url: failure.url, method: 'POST', status: 500 },
    } as never)
    const result = await runPage(pipelineContext(), {
      url: 'https://example.com', position: 0, role: 'primary', primary: true,
    })
    expect(result.flags.map(flag => flag.checkId)).toContain('api-engagement-server-error')
    expect(result.flags.map(flag => flag.checkId)).toContain('form-submit-api-server-error')
    expect(recordTargetedPageVerifierExecutions).toHaveBeenCalledWith(expect.objectContaining({
      flowCompleted: true, availableTools: expect.arrayContaining(['flow-navigation']),
    }))
    expect(vi.mocked(recordTargetedPageVerifierExecutions).mock.invocationCallOrder[0])
      .toBeGreaterThan(vi.mocked(runFlowScan).mock.invocationCallOrder[0])
    expect(prismaMock.audit.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        flowData: expect.objectContaining({ status: 'success' }),
        performanceData: expect.objectContaining({ networkFailures: [failure] }),
      }),
    }))
    expect(close).toHaveBeenCalledOnce()
    expect(disposeNetwork).toHaveBeenCalledOnce()
  })

  it('closes a failed walk and preserves observed failures without claiming flow coverage', async () => {
    const failure = { url: 'https://example.com/api/signup', method: 'POST', status: 403,
      resourceType: 'fetch', sameOrigin: true, engagementPath: true, at: Date.now() }
    const close = vi.fn(async () => undefined)
    const disposeNetwork = vi.fn()
    vi.mocked(createAuditPage).mockResolvedValue({
      page: { context: () => ({ close }) }, disposeNetwork, networkFailures: [failure], formProbe: null,
    } as never)
    vi.mocked(runFlowScan).mockRejectedValueOnce(new Error('walk interrupted'))
    const result = await runPage(pipelineContext(), {
      url: 'https://example.com', position: 0, role: 'primary', primary: true,
    })
    expect(result.flowScan).toBe(false)
    expect(result.flags.map(flag => flag.checkId)).toContain('api-engagement-unauthorized')
    expect(close).toHaveBeenCalledOnce()
    expect(disposeNetwork).toHaveBeenCalledOnce()
    expect(recordTargetedPageVerifierExecutions).toHaveBeenCalledWith(expect.objectContaining({
      flowCompleted: false,
    }))
  })

  it.each(['timeout', 'skipped'] as const)('does not count %s flow as completed verification', async status => {
    vi.mocked(runFlowScan).mockResolvedValueOnce({ status, steps: [], finalUrl: 'https://example.com/' })
    const result = await runPage(pipelineContext(), {
      url: 'https://example.com', position: 0, role: 'primary', primary: true,
    })
    expect(result.flowScan).toBe(false)
    expect(recordTargetedPageVerifierExecutions).toHaveBeenCalledWith(expect.objectContaining({ flowCompleted: false }))
  })

  it('rechecks the flow budget after capture consumes time', async () => {
    const ctx = pipelineContext()
    captureMock.mockImplementationOnce(async () => {
      ctx.deadline = Date.now() + 40_000
      return { desktopUrl: 'https://cdn/desktop.png', mobileUrl: 'https://cdn/mobile.png',
        desktopBase64: 'abc', mobileBase64: 'def', desktopHtml: '<html></html>',
        consoleErrors: [], captureStatus: { desktop: 'ok', mobile: 'ok' } }
    })
    await runPage(ctx, { url: 'https://example.com', position: 0, role: 'primary', primary: true })
    expect(runFlowScan).not.toHaveBeenCalled()
    expect(recordTargetedPageVerifierExecutions).toHaveBeenCalledWith(expect.objectContaining({ flowCompleted: false }))
  })

})
