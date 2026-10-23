import { describe, expect, it } from 'vitest'
import { historyExecutionFilter, historyExecutionScope, projectHistory } from '../monitoring-history'
import { categoryCoverageExecutionSelect, siteCoverageExecutionSelect } from '../site-execution'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { executionSpecSchema } from '../../domain/execution-spec'
import { serializeArtifact } from '@/lib/audit/progressive/contracts'

const coverage = { environment: 'production', requiredBindings: ['http'], observedBindings: ['http'],
  bindings: [{ key: 'http', version: 1, mechanism: 'HTTP_AVAILABILITY', config: { startUrl: 'https://example.com/' } }] }
function row(assessment: unknown) {
  return { id: 'audit', status: 'COMPLETED', failureCode: null, failedModules: [], pages: [], flags: [],
    completedAt: new Date('2026-10-11T12:00:00Z'), updatedAt: new Date(), executionSpec: { scope: 'OUTCOMES' }, recheckTrigger: 'WATCH',
    verificationAttempts: [], runRequests: [{ source: 'WATCH', verificationTarget: null,
      selections: [{ outcome: { name: 'The page loads' } }], assessments: [assessment] }] }
}
describe('history execution loading', () => {
  const shared = [
    { workKind: 'automatic-accounts', workState: 'COMPLETED' },
    { targetKey: { startsWith: 'task:' }, workKind: 'browser' },
  ]
  it('keeps each recorded scope on its own execution filter', () => {
    expect(historyExecutionScope({ scope: 'SITE', version: 'old' })).toBe('SITE')
    expect(historyExecutionScope({ scope: 'CATEGORY' })).toBe('CATEGORY')
    expect(historyExecutionScope({ scope: 'ACCOUNT_CHECKS' })).toBe('OTHER')
    expect(historyExecutionScope(null)).toBe('OTHER')
    expect(historyExecutionFilter('SITE')).toEqual([...shared, ...siteCoverageExecutionSelect.where.OR])
    expect(historyExecutionFilter('CATEGORY')).toEqual([...shared, ...categoryCoverageExecutionSelect.where.OR])
    expect(historyExecutionFilter('OTHER')).toEqual(shared)
  })
})

describe('scope completion in monitoring history', () => {
  it('keeps an uncollected broad page in the historical completion denominator', () => {
    const targetUrl = 'https://example.com/', peer = targetUrl + 'pricing'
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl,
      environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null, monitoringPages: [targetUrl, peer] })
    const audit = { ...row(null), parentId: null, executionSpec: spec, runRequests: [], pages: [{ url: targetUrl, status: 'COMPLETED' }], verifierExecutions: [
      { targetKey: 'projection:flag-comparison', status: 'COMPLETED', detail: { kind: 'flag-comparison', version: 1, auditId: 'audit', parentAuditId: null,
        summary: { newIssues: [], unchanged: [], regressed: [], fixed: [], inconclusive: [] } } },
      { targetKey: 'module:security', status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1, module: 'security', applicable: true, passed: true,
        pageUrl: targetUrl, assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })) } },
    ] }
    expect(projectHistory(audit as never, [])).toMatchObject({ scope: 'SITE', completionState: 'PARTIAL' })
    expect(projectHistory({ ...audit, pages: [...audit.pages, { url: peer, status: 'COMPLETED' }] } as never, []))
      .toMatchObject({ completionState: 'COMPLETED' })
  })
  it('does not let unavailable account behavior become a complete account history entry', () => {
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', scope: 'ACCOUNT_CHECKS', targetUrl: 'https://example.com/',
      environment: 'production', checks: {}, outcomes: [], verificationTarget: null, accountChecks: { revision: 2, mode: 'routine' } })
    const audit = { ...row(null), executionSpec: spec, runRequests: [] }
    const observation = { kind: 'signed_in', state: 'verified', detail: 'Signed-in navigation was observed.', pageUrl: spec.targetUrl, evidence: {} }
    expect(projectHistory(audit as never, [], [], serializeArtifact('automatic-accounts', { observations: [observation] })))
      .toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
    expect(projectHistory(audit as never, [], [], serializeArtifact('automatic-accounts', { observations: [
      observation, { ...observation, kind: 'deletion', state: 'unavailable' },
    ] }))).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
  })
  it('agrees with run reads on the exact immutable diagnostic attempt', () => {
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', scope: 'DIAGNOSTIC', targetUrl: 'https://example.com/',
      environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: {
        kind: 'DIAGNOSTIC', checkId: 'no-https', pageUrl: 'https://example.com/', parentAuditId: 'before', attemptId: 'attempt',
      } })
    const audit = { ...row(null), parentId: 'before', executionSpec: spec, runRequests: [], verificationAttempts: [{
      id: 'attempt', sourceAuditId: 'before', verificationAuditId: 'audit', comparable: true, outcome: 'IMPROVED',
      evidenceReference: { beforeAuditId: 'before', afterAuditId: 'audit' },
    }] }
    expect(projectHistory(audit as never, [])).toMatchObject({ result: 'CLEAR', completionState: 'COMPLETED' })
    audit.verificationAttempts[0].outcome = 'UNCHANGED'
    expect(projectHistory(audit as never, [])).toMatchObject({ result: 'FLAG', completionState: 'COMPLETED' })
    audit.verificationAttempts[0].id = 'unrelated'
    expect(projectHistory(audit as never, [])).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
  })
  it('uses the recorded category scope, required tasks and immutable assessment in history', () => {
    const spec = executionSpecSchema.parse({ version: 1, engine: 'progressive-v1', scope: 'CATEGORY', targetUrl: 'https://example.com/', environment: 'production',
      category: { area: 'security', sourceAuditId: 'full', pages: ['https://example.com/'] }, checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null })
    const receipt = { targetKey: 'module:security', status: 'COMPLETED', detail: { kind: 'site-module-check', version: 1, module: 'security',
      pageUrl: spec.targetUrl, passed: true, applicable: true, complete: true,
      assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })) } }
    const comparison = { targetKey: 'projection:flag-comparison', status: 'COMPLETED', detail: { kind: 'flag-comparison', version: 1, auditId: 'audit', parentAuditId: 'full',
      summary: { fixed: [], inconclusive: [], unchanged: [], regressed: [], newIssues: [] } } }
    const audit = { ...row(null), parentId: 'full', evidenceCoverage: {}, executionSpec: spec,
      runRequests: [], pages: [{ url: spec.targetUrl, status: 'COMPLETED' }],
      verifierExecutions: [receipt, comparison, ...initialTaskPlan(spec).map(task => ({ targetKey: 'task:' + task.key, status: 'COMPLETED',
        workKind: task.kind, workState: 'COMPLETED', workDependencies: task.dependencies }))] }
    expect(projectHistory(audit as never, [])).toMatchObject({ scope: 'CATEGORY', targetLabel: 'Security', result: 'CLEAR', completionState: 'COMPLETED' })
    audit.verifierExecutions = [receipt, comparison]
    expect(projectHistory(audit as never, [])).toMatchObject({ result: 'COULD_NOT_VERIFY', completionState: 'PARTIAL' })
  })
  it('shows complete proved uptime despite the absence of broad report pages', () => {
    expect(projectHistory(row({ state: 'CLEAR', coverage, evidence: { reason: 'available' } }) as never, [])).toMatchObject({ completionState: 'COMPLETED', result: 'CLEAR', scope: 'OUTCOMES' })
  })
  it('links recovery to the exact recorded original Flag and source audit', () => {
    const audit = { ...row({ state: 'CLEAR', coverage, evidence: { reason: 'available' } }),
      executionSpec: { scope: 'DIAGNOSTIC', verificationTarget: { kind: 'DIAGNOSTIC', attemptId: 'attempt', pageUrl: 'https://example.com/billing' } },
      verificationAttempts: [{ id: 'attempt', comparable: true, outcome: 'IMPROVED', handoffReference: 'flag:original', sourceAuditId: 'before' }] }
    const source = { id: 'original', problem: 'Billing page is unavailable', auditId: 'before' }
    expect(projectHistory(audit as never, [], [source]).flags).toEqual([{ id: 'original', title: source.problem }])
    expect(projectHistory(audit as never, [], [{ ...source, auditId: 'other' }]).flags).toEqual([])
  })
  it('keeps missing and blocked evidence partial rather than deriving completeness from run completion', () => {
    for (const assessment of [{ state: 'COULD_NOT_VERIFY', coverage, evidence: { reason: 'bot_wall' } },
      { state: 'CLEAR', coverage: { ...coverage, observedBindings: [] }, evidence: { reason: 'available' } }])
      expect(projectHistory(row(assessment) as never, []).completionState).toBe('PARTIAL')
  })
})
