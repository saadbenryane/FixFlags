import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { applicableCategoryEvidence, overlayCategoryCoverage, type CategoryEvidenceAudit } from '../category-evidence'
import { buildCoverageFacts } from '../../coverage'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { readExecutionSpec } from '../../domain/execution-spec'
import { siteCoverageMaxAgeMs } from '../../evidence-freshness'

const now = new Date('2026-10-12T12:00:00Z')
const baseline = { id: 'full', status: 'COMPLETED', createdAt: new Date('2026-10-11T12:00:00Z') }
function category(overrides: Partial<CategoryEvidenceAudit> = {}): CategoryEvidenceAudit {
  return { id: 'security-recheck', parentId: baseline.id, projectId: 'site', status: 'COMPLETED', createdAt: now, completedAt: now,
    executionSpec: { version: 1, engine: 'progressive-v1', scope: 'CATEGORY', environment: 'production',
      targetUrl: 'https://example.com/', category: { area: 'security', sourceAuditId: baseline.id, pages: ['https://example.com/'] },
      checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null },
    failureCode: null, failedModules: [], evidenceCoverage: {}, pages: [{ url: 'https://example.com/', status: 'COMPLETED' }],
    verifierExecutions: [{ id: 'receipt', targetKey: 'module:security', status: 'COMPLETED', workKind: null, workState: null, workDependencies: [], pageUrl: 'https://example.com/', updatedAt: now,
      detail: { kind: 'site-module-check', version: 1, module: 'security', passed: true, applicable: true, complete: true,
        pageUrl: 'https://example.com/', assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })) } }],
    ...overrides }
}
const base = () => buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: baseline.createdAt, now,
  evidenceCoverage: { metadata: true, desktopPageSpeed: true }, flags: [] })
function completedCategory() {
  const audit = category()
  audit.verifierExecutions.push({ id: 'comparison', targetKey: 'projection:flag-comparison', status: 'COMPLETED', workKind: null,
    workState: null, workDependencies: [], pageUrl: null, updatedAt: now, detail: { kind: 'flag-comparison', version: 1,
      auditId: audit.id, parentAuditId: audit.parentId,
      summary: { newIssues: [], unchanged: [], regressed: [], fixed: [], inconclusive: [] } } })
  audit.verifierExecutions.push(...initialTaskPlan(readExecutionSpec(audit.executionSpec)!).map(task => ({ id: task.key, targetKey: 'task:' + task.key,
    status: 'COMPLETED' as const, workKind: task.kind, workState: 'COMPLETED' as const, workDependencies: task.dependencies,
    pageUrl: task.input.pageUrl, updatedAt: now, detail: null })))
  return audit
}

describe('category evidence projection', () => {
  it('refreshes only its admitted area and keeps the broad evidence dates', () => {
    const before = base(), selected = applicableCategoryEvidence([completedCategory()], baseline)
    const after = overlayCategoryCoverage(before, selected, now)
    expect(after.find(fact => fact.area === 'security')).toMatchObject({ state: 'healthy', checkedAt: now.toISOString() })
    for (const fact of before.filter(fact => fact.area !== 'security')) expect(after.find(item => item.area === fact.area)).toEqual(fact)
  })
  it('applies current broad care to category observations while leaving their recorded window intact', () => {
    const before = base(), selected = applicableCategoryEvidence([completedCategory()], baseline)
    const later = new Date(now.getTime() + 2 * 86400_000)
    const current = overlayCategoryCoverage(before, selected, later, [], siteCoverageMaxAgeMs('hourly'))
    expect(current.find(fact => fact.area === 'security')).toMatchObject({ state: 'unknown', stale: true, checkedAt: now.toISOString() })
    for (const fact of before.filter(fact => fact.area !== 'security')) expect(current.find(item => item.area === fact.area)).toEqual(fact)
    expect(overlayCategoryCoverage(before, selected, later).find(fact => fact.area === 'security')).toMatchObject({ state: 'healthy' })
  })
  it.each(['FAILED', 'CHECKING', 'QUEUED'])('does not let a %s attempt reuse an older passing conclusion', status => {
    const old = category({ id: 'old', createdAt: new Date(now.getTime() - 1000) })
    const selected = applicableCategoryEvidence([old, category({ status, completedAt: null, pages: [] })], baseline)
    const result = overlayCategoryCoverage(base(), selected, now).find(fact => fact.area === 'security')!
    expect(result).toMatchObject({ state: 'unknown', evidenced: false })
    expect(result.incompleteReason).toBeTruthy()
  })
  it('requires the frozen page inventory and retains confirmed findings through a gap', () => {
    const audit = category({ pages: [] })
    const result = overlayCategoryCoverage(base(), applicableCategoryEvidence([audit], baseline), now,
      [{ checkId: 'no-https', rubric: 'REACH', severity: 'IMPORTANT', impactTag: 'TRUST' }])
    expect(result.find(fact => fact.area === 'security')).toMatchObject({ state: 'problem', evidenced: false, openFlagCount: 1 })
  })
  it('requires every admitted task even when one module receipt could otherwise appear healthy', () => {
    const audit = completedCategory()
    audit.verifierExecutions = audit.verifierExecutions.filter(record => record.targetKey !== 'task:p0:http')
    const result = overlayCategoryCoverage(base(), applicableCategoryEvidence([audit], baseline), now)
    expect(result.find(fact => fact.area === 'security')).toMatchObject({ state: 'unknown', evidenced: false })
  })
  it('withholds category health until its own comparison projection is committed', () => {
    const audit = completedCategory()
    audit.verifierExecutions = audit.verifierExecutions.filter(record => record.targetKey !== 'projection:flag-comparison')
    expect(overlayCategoryCoverage(base(), applicableCategoryEvidence([audit], baseline), now).find(fact => fact.area === 'security'))
      .toMatchObject({ state: 'unknown', evidenced: false })
  })
  it('reads the recorded obligations rather than regenerating an older plan with current code', () => {
    const audit = completedCategory()
    // This historical execution admitted an additional local evaluator.
    audit.verifierExecutions.push({ id: 'retired-task', targetKey: 'task:p0:retired-evaluator', status: 'COMPLETED',
      workKind: 'check', workState: 'COMPLETED', workDependencies: ['p0:http'], pageUrl: 'https://example.com/', updatedAt: now, detail: null })
    audit.verifierExecutions.find(record => record.targetKey === 'task:finalize')!.workDependencies.push('p0:retired-evaluator')
    const result = () => overlayCategoryCoverage(base(), applicableCategoryEvidence([audit], baseline), now).find(fact => fact.area === 'security')!
    expect(result()).toMatchObject({ state: 'healthy', evidenced: true })
    audit.verifierExecutions.find(record => record.targetKey === 'task:p0:retired-evaluator')!.workState = 'EXHAUSTED'
    expect(result()).toMatchObject({ state: 'unknown', evidenced: false })
  })
  it('rejects evidence based on an older full-site inventory or an invalid snapshot', () => {
    expect(applicableCategoryEvidence([category()], { ...baseline, id: 'new-full' }).size).toBe(0)
    expect(applicableCategoryEvidence([category()], { ...baseline, status: 'CHECKING' }).size).toBe(0)
    expect(applicableCategoryEvidence([category({ executionSpec: {} })], baseline).size).toBe(0)
  })
})
