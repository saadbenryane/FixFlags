import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ findFirst: vi.fn(), task: vi.fn() }))
vi.mock('@/lib/db', () => ({ prisma: { runRequest: { findFirst: mocks.findFirst }, auditVerifierExecution: { findFirst: mocks.task } } }))
import { getOwnedRun } from '../run-queries'
import type { FlagDiffSummary } from '@/lib/audit/flag-comparison'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { readExecutionSpec } from '../../domain/execution-spec'
import { serializeArtifact } from '@/lib/audit/progressive/contracts'

const now = new Date('2026-10-12T12:00:00Z')
function observed(module: string, keys: string[]) {
  return { targetKey: 'module:' + module, status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1, module,
    pageUrl: 'https://acme.fixture.test/', passed: true, applicable: true,
    assertions: keys.map(key => ({ key, name: key, expected: 'Observed', observed: 'Recorded fixture input', passed: true, complete: true })) } }
}
function comparison(newIssues: FlagDiffSummary['newIssues'] = []) {
  return { targetKey: 'projection:flag-comparison', status: 'COMPLETED', detail: {
    kind: 'flag-comparison', version: 1, auditId: 'audit-1', parentAuditId: null,
    summary: { newIssues, unchanged: [], regressed: [], fixed: [], inconclusive: [] },
  } }
}
function run(overrides: Record<string, unknown> = {}) {
  return { id: 'run-1', source: 'WEB', status: 'COMPLETED', requestedAt: now, completedAt: now,
    verificationTarget: null, auditId: 'audit-1', errorMessage: null, selections: [], assessments: [],
    executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: 'https://acme.fixture.test/',
      environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null },
    audit: { id: 'audit-1', parentId: null, progress: 100, status: 'COMPLETED', completedAt: now, reportCompleteness: 'FULL',
      evidenceCoverage: { metadata: true, desktopPageSpeed: true, flowScan: true }, failedModules: [], failureCode: null,
      verifierExecutions: [observed('security', ['https', 'image-transport']), comparison()], flags: [], pages: [{ url: 'https://acme.fixture.test/', status: 'COMPLETED' }] },
    ...overrides }
}

describe('owned run assessment', () => {
  function diagnostic() {
    const source = run()
    source.executionSpec = { ...source.executionSpec, scope: 'DIAGNOSTIC', verificationTarget: {
      kind: 'DIAGNOSTIC', attemptId: 'attempt', parentAuditId: 'before', checkId: 'no-https', pageUrl: source.executionSpec.targetUrl,
    } } as never
    source.audit = { ...source.audit, parentId: 'before', verificationAttempts: [{ id: 'attempt', sourceAuditId: 'before',
      verificationAuditId: 'audit-1', comparable: true, outcome: 'IMPROVED', evidenceReference: {
        beforeAuditId: 'before', afterAuditId: 'audit-1', beforeFlagId: 'original', afterFlagId: null,
      } }] } as never
    return source
  }
  it('reports the exact independent diagnostic conclusion and its freshness', async () => {
    const source = diagnostic()
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ scope: 'DIAGNOSTIC', result: 'CLEAR',
      coverage: { completeness: 'FULL', requiredAreas: [], gaps: [] }, validUntil: '2026-10-20T12:00:00.000Z',
      summary: 'This verification confirmed recovery under the recorded failure conditions.' })
    const attempts = (source.audit as unknown as { verificationAttempts: Array<{ outcome: string }> }).verificationAttempts
    for (const outcome of ['UNCHANGED', 'REGRESSED']) {
      attempts[0].outcome = outcome
      expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'FLAG', coverage: { completeness: 'FULL' } })
    }
    attempts[0].outcome = 'IMPROVED'
    vi.setSystemTime('2026-10-21T12:00:00Z')
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'STALE', coverage: { completeness: 'FULL' } })
  })
  it('refuses missing, inconclusive and mismatched diagnostic repair receipts', async () => {
    for (const patch of [{ id: 'other' }, { sourceAuditId: 'other' }, { verificationAuditId: 'other' },
      { evidenceReference: { beforeAuditId: 'before', afterAuditId: 'other' } }, { comparable: false },
      { outcome: 'INCONCLUSIVE' }, { outcome: null }]) {
      const source = diagnostic()
      const attempts = (source.audit as unknown as { verificationAttempts: Array<Record<string, unknown>> }).verificationAttempts
      Object.assign(attempts[0], patch)
      mocks.findFirst.mockResolvedValue(source)
      expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: { completeness: 'PARTIAL' } })
    }
    const source = diagnostic()
    source.audit.parentId = 'different-source' as never
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY' })
  })
  it('uses only committed account observations, retaining failure alongside incomplete behavior', async () => {
    const source = run()
    source.executionSpec = { ...source.executionSpec, scope: 'ACCOUNT_CHECKS', accountChecks: { revision: 2, mode: 'routine' } } as never
    mocks.findFirst.mockResolvedValue(source)
    const observation = { kind: 'signed_in', state: 'verified', detail: 'Signed-in navigation was observed.',
      pageUrl: source.executionSpec.targetUrl, evidence: {} }
    mocks.task.mockResolvedValue({ workResult: serializeArtifact('automatic-accounts', { observations: [observation] }) })
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ scope: 'ACCOUNT_CHECKS', result: 'CLEAR', completionState: 'FULL' })
    expect(mocks.task).toHaveBeenCalledWith({ where: { auditId: 'audit-1', targetKey: 'task:automatic-accounts',
      workKind: 'automatic-accounts', workState: 'COMPLETED' }, select: { workResult: true } })
    mocks.task.mockResolvedValue({ workResult: serializeArtifact('automatic-accounts', { observations: [
      { ...observation, state: 'failed' }, { ...observation, kind: 'deletion', state: 'unknown' },
    ] }) })
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'FLAG', completionState: 'PARTIAL' })
    for (const workResult of [null, serializeArtifact('browser', { observations: [observation] }),
      serializeArtifact('automatic-accounts', { observations: [{ ...observation, state: 'unavailable' }] }),
      serializeArtifact('automatic-accounts', { observations: [{ ...observation, pageUrl: 'https://other.test/' }] })]) {
      mocks.task.mockResolvedValue({ workResult })
      expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
    }
  })
  it('returns category scope and never treats an unrelated completed page as its required page', async () => {
    const source = run()
    source.executionSpec = { ...source.executionSpec, scope: 'CATEGORY', category: {
      area: 'security', sourceAuditId: 'full', pages: ['https://acme.fixture.test/'] } } as never
    source.audit.pages = [{ url: 'https://acme.fixture.test/', status: 'COMPLETED' }] as never
    source.audit.verifierExecutions.push(...initialTaskPlan(readExecutionSpec(source.executionSpec)!).map(task => ({
      targetKey: 'task:' + task.key, status: 'COMPLETED', workKind: task.kind, workState: 'COMPLETED', workDependencies: task.dependencies, detail: null,
    })) as never)
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ scope: 'CATEGORY', area: 'security', result: 'CLEAR',
      summary: 'The required category scope was checked with current evidence.', coverage: { requiredAreas: ['security'] } })
    source.audit.pages = [{ url: 'https://acme.fixture.test/other', status: 'COMPLETED' }] as never
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: { completeness: 'PARTIAL' } })
  })
  beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(now); mocks.findFirst.mockReset(); mocks.task.mockReset() })
  afterEach(() => { vi.useRealTimers() })
  it('returns a settled full-site assessment with scope, completeness and freshness', async () => {
    mocks.findFirst.mockResolvedValue(run())
    const result = await getOwnedRun('owner', 'run-1')
    expect(result).toMatchObject({ result: 'CLEAR', scope: 'SITE', completionState: 'FULL', checkedAt: now.toISOString(),
      outcomeId: null, coverage: { result: 'CLEAR', requiredAreas: ['security'], completeness: 'FULL', gaps: [] } })
    expect(result?.summary).toBeTruthy()
    expect(result?.validUntil).toBe('2026-10-20T12:00:00.000Z')
    expect(mocks.findFirst.mock.calls[0][0].where).toEqual({ id: 'run-1', project: { userId: 'owner', deletedAt: null } })
  })
  it('retains admitted and discovered pages that have no observation row', async () => {
    const source = run(), peer = source.executionSpec.targetUrl + 'pricing'
    source.executionSpec = { ...source.executionSpec, monitoringPages: [source.executionSpec.targetUrl, peer] } as never
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL',
      coverage: { gaps: [{ area: 'site', reason: 'pages' }] } })
    source.executionSpec = { ...source.executionSpec, monitoringPages: undefined } as never
    source.audit.verifierExecutions.push({ targetKey: 'task:p1:browser', workKind: 'browser', status: 'FAILED', pageUrl: peer } as never)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
  })
  it('does not emit a settled result while the run is queued or running', async () => {
    for (const status of ['QUEUED', 'RUNNING']) {
      mocks.findFirst.mockResolvedValue(run({ status }))
      expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: null, summary: null, completionState: 'PENDING' })
    }
  })
  it('preserves recorded failure even if that source Flag has subsequently been resolved', async () => {
    const source = run()
    source.audit.flags = [{ checkId: 'no-https', rubric: 'REACH', impactTag: 'TRUST', severity: 'IMPORTANT', confidence: 1, status: 'FIXED' }] as never
    source.audit.verifierExecutions = [observed('security', ['https', 'image-transport']), comparison([
      { checkId: 'no-https', problem: 'The inspected page uses HTTP', rubric: 'REACH', impactTag: 'TRUST', severity: 'IMPORTANT', confidence: 1, status: 'OPEN' },
    ])]
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'FLAG' })
  })
  it('cannot replace missing or mismatched recorded conclusions with a passing modern assessment', async () => {
    for (const checkpoint of [null, { ...comparison(), detail: { ...comparison().detail, auditId: 'different-audit' } }]) {
      const source = run()
      source.audit.verifierExecutions = [observed('security', ['https', 'image-transport']), ...checkpoint ? [checkpoint] : []]
      mocks.findFirst.mockResolvedValue(source)
      expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: { completeness: 'PARTIAL' } })
    }
  })
  it('retains an original customer Flag when its exact recovery scope is inconclusive', async () => {
    const source = run()
    const receipt = comparison()
    receipt.detail.summary.inconclusive = [{ id: 'original', checkId: 'no-https', problem: 'The original page used HTTP.',
      severity: 'IMPORTANT', confidence: 1, rubric: 'REACH', status: 'OPEN' }] as never
    source.audit.verifierExecutions = [observed('security', ['https', 'image-transport']), receipt]
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'FLAG', completionState: 'PARTIAL',
      coverage: { completeness: 'PARTIAL', gaps: [{ area: null, reason: 'unassessed' }] } })
    receipt.detail.summary.inconclusive[0].severity = 'POLISH' as never
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'CLEAR', completionState: 'FULL' })
  })
  it('exposes incomplete scope and failed execution without replacing them with Clear', async () => {
    const source = run()
    source.audit.verifierExecutions = []
    source.audit.evidenceCoverage = {} as never
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: { completeness: 'PARTIAL' } })
    mocks.findFirst.mockResolvedValue(run({ status: 'FAILED' }))
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'FAILED' })
  })
  it('does not certify a selected Outcome whose assessment is absent', async () => {
    mocks.findFirst.mockResolvedValue(run({ executionSpec: null,
      selections: [{ outcomeId: 'checkout', outcome: { id: 'checkout', name: 'Checkout' } }],
      assessments: [] }))
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY' })
  })
  it('requires every frozen broad-run Outcome even when a selection row is missing', async () => {
    const source = run()
    source.executionSpec.outcomes = [{ id: 'checkout', kind: 'CHECKOUT', expectation: null, bindingPolicy: 'ALL_REQUIRED', bindings: [] }] as never
    mocks.findFirst.mockResolvedValue(source)
    expect(await getOwnedRun('owner', 'run-1')).toMatchObject({ result: 'COULD_NOT_VERIFY', coverage: { gaps: [{ area: null, outcomeId: 'checkout', reason: 'incomplete' }] } })
  })
  it('returns no data for another owner', async () => {
    mocks.findFirst.mockResolvedValue(null)
    expect(await getOwnedRun('stranger', 'run-1')).toBeNull()
  })
})
