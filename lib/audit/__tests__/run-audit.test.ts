import { describe, it, vi, expect, beforeEach, type Mock } from 'vitest'
import { AuditDeadlineError } from '@/lib/audit/pipeline-errors'

/**
 * Drives the real `runAudit` orchestrator with the heavy pipeline leaves
 * (capture, AI, persistence, finalize) mocked, so we can assert the state
 * machine itself: status transitions, fail-at-a-step, timeout, retry-after-crash,
 * and the AI-failure fallback. See QUALITY.md "Pipeline failures mid-audit".
 */

const { prismaMock } = vi.hoisted(() => {
  const prismaMock = {
    audit: { findUnique: vi.fn(), update: vi.fn() },
    screenshot: { deleteMany: vi.fn() },
    auditPage: { deleteMany: vi.fn() },
    $transaction: vi.fn(async (arg: unknown) => {
      if (typeof arg === 'function') return (arg as (tx: unknown) => unknown)(prismaMock)
      if (Array.isArray(arg)) return Promise.all(arg)
      return arg
    }),
  }
  return { prismaMock }
})

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/logger/context', () => ({
  runWithContext: (_ctx: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/audit/pipeline-log', () => ({
  initPipelineLog: vi.fn(),
  logPipelineEvent: vi.fn(),
}))
vi.mock('@/lib/audit/critical-path', () => ({ discoverCriticalPathUrls: vi.fn(() => []) }))
vi.mock('@/lib/audit/copy-parent-artifacts', () => ({ copyParentArtifacts: vi.fn() }))
vi.mock('@/lib/audit/persist', () => ({ persistTriageResults: vi.fn() }))
vi.mock('@/lib/audit/persist-evidence-anchors', () => ({
  tryResolveEvidenceAnchorsForAudit: vi.fn(),
  mergeFlowCtaEvidenceAnchors: vi.fn(),
}))
vi.mock('@/lib/audit/finalize', () => ({
  finalizeTriageAudit: vi.fn(),
  finalizeDeterministicOnly: vi.fn(),
  persistFailedAuditCost: vi.fn(),
}))
vi.mock('@/lib/audit/enqueue-ai-review', () => ({ enqueueAiReview: vi.fn() }))
vi.mock('@/lib/audit/pipeline/run-page', () => ({ runPage: vi.fn() }))
vi.mock('@/lib/audit/pipeline/combine-pages', () => ({
  averageScores: vi.fn(() => ({})),
  buildCombinedTriageOutput: vi.fn(() => ({})),
}))
vi.mock('@/lib/audit/pipeline/context', () => ({
  sanitizeAuditErrorMessage: (msg: string) => msg,
  tryPartialFinalize: vi.fn(() => false),
}))
vi.mock('@/lib/audit/pipeline/failure', () => ({
  deriveAuditFailure: vi.fn(() => ({ failureCode: 'AUDIT_PIPELINE_FAILED', failureStage: 'capturing' })),
}))

import { runAudit } from '@/lib/audit/runner'
import { runPage } from '@/lib/audit/pipeline/run-page'
import { persistTriageResults } from '@/lib/audit/persist'
import {
  finalizeTriageAudit,
  finalizeDeterministicOnly,
} from '@/lib/audit/finalize'
import { tryPartialFinalize } from '@/lib/audit/pipeline/context'

function makeAudit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'audit-1',
    status: 'QUEUED',
    url: 'https://example.com',
    includeAi: false,
    monitoringMode: null,
    parentId: null,
    auditMode: 'SINGLE',
    ...overrides,
  }
}

function makePageRun(overrides: Record<string, unknown> = {}) {
  return {
    pageId: 'page-1',
    url: 'https://example.com',
    metadata: { pageText: '' },
    desktop: null,
    mobile: null,
    desktopScreenshot: true,
    mobileScreenshot: true,
    flowScan: false,
    flowResult: null,
    desktopBase64: 'x',
    mobileBase64: null,
    flags: [],
    failedModules: [],
    triage: {},
    detectedTech: [],
    industryGuess: null,
    ...overrides,
  }
}

function updateStatuses(): string[] {
  return prismaMock.audit.update.mock.calls.map(
    (c: unknown[]) => (c[0] as { data: { status?: string } }).data.status ?? ''
  )
}

describe('runAudit orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.audit.findUnique.mockResolvedValue(makeAudit())
    prismaMock.audit.update.mockResolvedValue({})
    ;(runPage as Mock).mockResolvedValue(makePageRun())
    ;(persistTriageResults as Mock).mockResolvedValue(undefined)
    ;(finalizeTriageAudit as Mock).mockResolvedValue(undefined)
    ;(finalizeDeterministicOnly as Mock).mockResolvedValue(undefined)
    ;(tryPartialFinalize as Mock).mockResolvedValue(false)
  })

  it('returns immediately for an already-completed audit (retry after crash is a no-op)', async () => {
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.findUnique.mockResolvedValue(makeAudit({ status: 'COMPLETED' }))

    await runAudit('audit-1')

    expect(prismaMock.audit.update).not.toHaveBeenCalled()
    expect(runPage).not.toHaveBeenCalled()
  })

  it('runs the happy path: CAPTURING -> persist -> triage finalize, no FAILED', async () => {
    await runAudit('audit-1')

    const first = prismaMock.audit.update.mock.calls[0][0] as { data: { status: string } }
    expect(first.data.status).toBe('CAPTURING')
    expect(persistTriageResults).toHaveBeenCalledTimes(1)
    expect(finalizeTriageAudit).toHaveBeenCalledTimes(1)
    expect(finalizeDeterministicOnly).not.toHaveBeenCalled()
    expect(updateStatuses()).not.toContain('FAILED')
  })

  it('marks the audit FAILED with the failure stage when capture throws, then rethrows', async () => {
    prismaMock.audit.findUnique.mockReset()
    prismaMock.audit.findUnique
      .mockResolvedValueOnce(makeAudit())
      .mockResolvedValue({ status: 'capturing' })
    ;(runPage as Mock).mockRejectedValue(new Error('capture blew up'))

    await expect(runAudit('audit-1')).rejects.toThrow('capture blew up')

    const failed = prismaMock.audit.update.mock.calls.find(
      (c: unknown[]) => (c[0] as { data: { status?: string } }).data.status === 'FAILED'
    )
    expect(failed).toBeTruthy()
    expect((failed![0] as { data: { failureStage: string } }).data.failureStage).toBe('capturing')
  })

  it('partial-finalizes on a mid-run timeout instead of failing', async () => {
    ;(runPage as Mock).mockRejectedValue(new AuditDeadlineError('capturing'))
    ;(tryPartialFinalize as Mock).mockResolvedValue(true)

    await runAudit('audit-1')

    expect(tryPartialFinalize).toHaveBeenCalledTimes(1)
    expect(updateStatuses()).not.toContain('FAILED')
  })

  it('falls back to deterministic-only when triage persistence fails', async () => {
    ;(persistTriageResults as Mock).mockRejectedValue(new Error('db down mid-persist'))

    await runAudit('audit-1')

    expect(finalizeDeterministicOnly).toHaveBeenCalledTimes(1)
    expect(finalizeTriageAudit).not.toHaveBeenCalled()
    expect(updateStatuses()).not.toContain('FAILED')
  })
})
