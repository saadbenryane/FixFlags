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
  runAllChecks: vi.fn(async () => ({ flags: [], failedModules: [] })),
  computeRubricScores: vi.fn(() => ({})),
  suppressOverlappingFlags: vi.fn((flags: unknown[]) => flags),
}))
vi.mock('@/lib/audit/checks/flow', () => ({ runFlowChecks: vi.fn(() => []) }))
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
vi.mock('@/lib/audit/checks/network-engagement', () => ({
  runNetworkEngagementChecks: vi.fn(() => []),
}))
vi.mock('@/lib/audit/persist', () => ({ persistDeterministicFlags: vi.fn() }))
vi.mock('@/lib/audit/pipeline-log', () => ({ logPipelineEvent: vi.fn() }))
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
import { logPipelineEvent } from '@/lib/audit/pipeline-log'
import { captureScreenshots } from '@/lib/audit/screenshot'

describe('runPage production capture path', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
    const ctx = {
      auditId: 'audit-1',
      deadline: Date.now() + 120_000,
      startedAt: new Date(),
      pagespeedCalls: 0,
      usage: { inputTokens: 0, outputTokens: 0, models: [] },
      includeAi: false,
    }

    const result = await runPage(ctx, {
      url: 'https://example.com',
      position: 0,
      role: 'primary',
      primary: true,
    })

    expect(slowReplayMock).toHaveBeenCalledWith(expect.anything(), 'audit-1', 'https://example.com/')
    expect(runSlowReplayChecks).toHaveBeenCalled()
    expect(result.flags.some((flag) => flag.checkId === 'slow-3g-blank-screen')).toBe(true)
    expect((logPipelineEvent as Mock).mock.calls.some((call) => call[1]?.event === 'slow_replay_completed')).toBe(
      true
    )
  })

  it('defers the flow walk: capture runs without flow, flow runs after checks when budget allows', async () => {
    const ctx = {
      auditId: 'audit-1',
      deadline: Date.now() + 120_000,
      startedAt: new Date(),
      pagespeedCalls: 0,
      usage: { inputTokens: 0, outputTokens: 0, models: [] },
      includeAi: false,
    }

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

  it('skips the flow walk and slow replay for an anonymous teaser scan', async () => {
    prismaMock.audit.findUnique.mockResolvedValue({
      projectId: null,
      userId: null,
      parentId: null,
    })
    const ctx = {
      auditId: 'audit-1',
      deadline: Date.now() + 120_000,
      startedAt: new Date(),
      pagespeedCalls: 0,
      usage: { inputTokens: 0, outputTokens: 0, models: [] },
      includeAi: false,
    }

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
    expect(slowReplayMock).not.toHaveBeenCalled()
    expect(runSlowReplayChecks).not.toHaveBeenCalled()
    expect(
      (logPipelineEvent as Mock).mock.calls.some((call) => call[1]?.event === 'slow_replay_skipped_teaser')
    ).toBe(true)
    expect(
      (logPipelineEvent as Mock).mock.calls.some((call) => call[1]?.event === 'flow_skipped_teaser')
    ).toBe(true)
    // The reduced pipeline still streams: checks-start progress anchor is written.
    expect(
      prismaMock.audit.update.mock.calls.some(
        (call: unknown[]) => (call[0] as { data?: { progress?: number } }).data?.progress === 42
      )
    ).toBe(true)
  })

  it('skips slow replay when the audit deadline is too tight', async () => {
    const ctx = {
      auditId: 'audit-1',
      deadline: Date.now() + 5_000,
      startedAt: new Date(),
      pagespeedCalls: 0,
      usage: { inputTokens: 0, outputTokens: 0, models: [] },
      includeAi: false,
    }

    await runPage(ctx, {
      url: 'https://example.com',
      position: 0,
      role: 'primary',
      primary: true,
    })

    expect(slowReplayMock).not.toHaveBeenCalled()
    expect((logPipelineEvent as Mock).mock.calls.some((call) => call[1]?.event === 'slow_replay_skipped_deadline')).toBe(
      true
    )
  })
})
