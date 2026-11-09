import { describe, expect, it, vi } from 'vitest'
vi.mock('@/lib/db', () => ({ prisma: {} }))
import { applicableCategoryEvidence, categoryEvidenceBaselines, overlayCategoryCoverage, type CategoryEvidenceAudit } from '../category-evidence'
import { buildCoverageFacts } from '../../coverage'
import { initialTaskPlan } from '@/lib/audit/progressive/graph'
import { readExecutionSpec } from '../../domain/execution-spec'
import { siteCoverageMaxAgeMs } from '../../evidence-freshness'
import { projectCurrentSiteEvidence } from '../current-evidence'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { recordCheckObservations } from '@/lib/audit/checks/observations'

const now = new Date('2026-10-12T12:00:00Z')
const baseline = { id: 'full', projectId: 'site', parentId: null, parent: null, status: 'COMPLETED', createdAt: new Date('2026-10-11T12:00:00Z') }
function category(overrides: Partial<CategoryEvidenceAudit> = {}): CategoryEvidenceAudit {
  return { id: 'security-recheck', parentId: baseline.id, projectId: 'site', parent: { projectId: 'site' }, status: 'COMPLETED', createdAt: now, startedAt: now, completedAt: now,
    executionSpec: { version: 1, engine: 'progressive-v1', scope: 'CATEGORY', environment: 'production',
      targetUrl: 'https://example.com/', category: { area: 'security', sourceAuditId: baseline.id, pages: ['https://example.com/'] },
      checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null },
    failureCode: null, failedModules: [], evidenceCoverage: {}, pages: [{ url: 'https://example.com/', status: 'COMPLETED' }],
    verifierExecutions: [{ id: 'receipt', targetKey: 'module:security', status: 'COMPLETED', workKind: null, workState: null, workDependencies: [], pageUrl: 'https://example.com/', updatedAt: now,
      detail: { kind: 'site-module-check', version: 1, module: 'security', passed: true, applicable: true, complete: true,
        pageUrl: 'https://example.com/', assertions: ['https', 'image-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })),
        execution: { auditId: 'security-recheck', taskId: 'security', checkVersion: 1, source: 'http', collectedAt: now.toISOString() } } }],
    ...overrides }
}
const base = () => buildCoverageFacts({ auditStatus: 'COMPLETED', completedAt: baseline.createdAt, now,
  evidenceCoverage: { metadata: true, desktopPageSpeed: true }, flags: [] })
function completedCategory(audit = category()) {
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
  it.each([false, true])('requires the frozen linked page in a mobile Performance recheck (observed: %s)', linkedObserved => {
    const root = 'https://example.com/', linked = root + 'pricing', id = 'performance-recheck'
    const audit = completedCategory(category({ id, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'CATEGORY',
      environment: 'production', targetUrl: root, category: { area: 'performance', sourceAuditId: baseline.id, pages: [root, linked] },
      checks: { 'mobile-lcp-poor': 1 }, outcomes: [], verificationTarget: null },
    evidenceCoverage: { desktopPageSpeed: true, mobilePageSpeed: true }, pages: [root, linked].map(url => ({ url, status: 'COMPLETED' })),
    verifierExecutions: (linkedObserved ? [root, linked] : [root]).map(pageUrl => {
      const mobile = healthyDesktopPs({ strategy: 'mobile', diagnostics: { measurement: pageSpeedMeasurementFixture(pageUrl, 'mobile') } })
      return { id: 'receipt-' + pageUrl, targetKey: 'module:mobile', status: 'COMPLETED', workKind: null, workState: null,
        workDependencies: [], pageUrl, updatedAt: now, detail: { kind: 'site-module-check', version: 1, module: 'mobile',
          applicable: true, complete: true, passed: true, pageUrl,
          assertions: recordCheckObservations('mobile', { url: pageUrl, desktop: null, mobile, metadata: null }).filter(item => item.key === 'lcp'),
          execution: { auditId: id, taskId: 'speed-' + pageUrl, checkVersion: 1, checkVersions: { 'mobile-lcp-poor': 1 },
            source: 'pagespeed-mobile', collectedAt: now.toISOString() } } }
    }) }))
    const selected = applicableCategoryEvidence([audit], baseline)
    const fact = overlayCategoryCoverage(base(), selected, now).find(item => item.area === 'performance')
    expect(fact?.state).toBe(linkedObserved ? 'healthy' : 'unknown')
    if (linkedObserved) expect(fact).toMatchObject({ label: 'Mobile speed measured' })
    else expect(fact?.incompleteReason).toEqual(expect.any(String))
  })

  it('selects only the applicable completed inventory within one Site', () => {
    const prior = { id: 'prior', status: 'COMPLETED' }
    for (const status of ['QUEUED', 'CHECKING', 'FAILED']) expect(categoryEvidenceBaselines('site', { id: 'current', status }, prior))
      .toEqual([{ projectId: 'site', auditId: 'prior' }])
    expect(categoryEvidenceBaselines('site', { id: 'current', status: 'COMPLETED' }, prior)).toEqual([{ projectId: 'site', auditId: 'current' }])
    expect(categoryEvidenceBaselines('site', prior, prior)).toEqual([{ projectId: 'site', auditId: 'prior' }])
    expect(categoryEvidenceBaselines('site', { id: 'current', status: 'QUEUED' }, { id: 'failed', status: 'FAILED' }))
      .toEqual([])
    expect(categoryEvidenceBaselines(null, prior, prior)).toEqual([])
    expect(categoryEvidenceBaselines('site', null, prior)).toEqual([])
  })
  it.each(['QUEUED', 'CHECKING', 'FAILED'])('retains a fresher category observation with the prior full report during %s broad work', status => {
    const prior = { ...baseline, createdAt: new Date(now.getTime() - 10 * 86400_000),
      completedAt: new Date(now.getTime() - 9 * 86400_000), evidenceCoverage: { metadata: true }, verifierExecutions: [] }
    const audit = { ...prior, id: 'new-full', status, createdAt: now, completedAt: null, evidenceCoverage: {} }
    const current = projectCurrentSiteEvidence({ audit, prior, categories: [completedCategory()], flags: [], now })
    expect(current.coverage.find(fact => fact.area === 'security')).toMatchObject({ state: 'healthy', evidenced: true, checkedAt: now.toISOString() })
    expect(current.coverage.find(fact => fact.area === 'performance')?.state).toBe('unknown')
    expect(current.categoryEvidence.size).toBe(0)
    expect(current.hasLastKnown).toBe(true)
  })
  it.each(['new-failure', 'new-gap', 'new-observation', 'completed', 'expired', 'incomplete-category'] as const)(
    'does not let retained category evidence conceal %s', condition => {
      const prior = { ...baseline, completedAt: baseline.createdAt, evidenceCoverage: {} }
      const recent = completedCategory()
      const observation = category().verifierExecutions[0]
      const audit = { ...prior, id: 'new-full', status: condition === 'completed' ? 'COMPLETED' : 'CHECKING', createdAt: now,
        completedAt: condition === 'completed' ? now : null,
        verifierExecutions: condition === 'new-gap' ? [{ ...observation, detail: { kind: 'site-module-check', version: 1,
          module: 'security', pageUrl: 'https://example.com/', passed: false, applicable: true, complete: false, assertions: [] } }]
          : condition === 'new-observation' ? [{ ...observation, detail: { kind: 'site-module-check', version: 1,
            module: 'security', pageUrl: 'https://example.com/', passed: true, applicable: true, complete: true,
            assertions: ['https', 'resource-transport'].map(key => ({ key, name: key, expected: 'Safe', observed: 'Observed', passed: true, complete: true })),
            execution: { auditId: 'new-full', taskId: 'current-security', checkVersion: 1, source: 'http', collectedAt: now.toISOString() } } }] : [] }
      if (condition === 'incomplete-category') recent.verifierExecutions = recent.verifierExecutions.filter(row => row.targetKey !== 'task:p0:http')
      if (condition === 'new-observation') recent.status = 'FAILED'
      const current = projectCurrentSiteEvidence({ audit, prior, categories: [recent],
        flags: condition === 'new-failure' ? [{ checkId: 'no-https', rubric: 'REACH', severity: 'IMPORTANT', impactTag: 'TRUST' }] : [],
        now: condition === 'expired' ? new Date(now.getTime() + 9 * 86400_000) : now })
      const fact = current.coverage.find(fact => fact.area === 'security')!
      expect(fact.state).toBe(condition === 'new-failure' ? 'problem' : condition === 'new-observation' ? 'healthy' : 'unknown')
      if (condition === 'new-failure') expect(fact.openFlagCount).toBe(1)
      if (condition === 'expired') expect(fact).toMatchObject({ stale: true, checkedAt: recent.completedAt!.toISOString() })
    })
  it('refreshes only its admitted area and keeps the broad evidence dates', () => {
    const before = base(), selected = applicableCategoryEvidence([completedCategory()], baseline)
    const after = overlayCategoryCoverage(before, selected, now)
    expect(after.find(fact => fact.area === 'security')).toMatchObject({ state: 'healthy', checkedAt: now.toISOString() })
    for (const fact of before.filter(fact => fact.area !== 'security')) expect(after.find(item => item.area === fact.area)).toEqual(fact)
  })
  it('withholds category assurance when the comparison parent belongs to another Site', () => {
    const audit = completedCategory(category({ parent: { projectId: 'foreign' } }))
    const selected = applicableCategoryEvidence([audit], baseline)
    expect(overlayCategoryCoverage(base(), selected, now).find(fact => fact.area === 'security'))
      .toMatchObject({ state: 'unknown', evidenced: false })
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
  it('keeps public Search conclusive when optional Google work has settled without evidence', () => {
    const pageUrl = 'https://example.com/'
    const audit = completedCategory(category({ id: 'search-recheck', executionSpec: {
      version: 1, engine: 'progressive-v1', scope: 'CATEGORY', environment: 'production', targetUrl: pageUrl,
      category: { area: 'search', sourceAuditId: baseline.id, pages: [pageUrl] }, checks: { 'title-missing': 2 },
      outcomes: [], verificationTarget: null,
    }, verifierExecutions: [{ id: 'search', targetKey: 'module:search', status: 'COMPLETED', workKind: null,
      workState: null, workDependencies: [], pageUrl, updatedAt: now, detail: {
        kind: 'search-checks', version: 1, auditId: 'search-recheck', pageUrl, collectedAt: now.toISOString(), complete: true,
        observations: [{ id: 'title', checkId: 'title-missing', checkVersion: 2, responsibility: 'presentation', name: 'Page title',
          disposition: 'passed', reason: 'title_present', expected: 'Page has a title', observed: 'Recorded title',
          source: 'original-html', collectedAt: now.toISOString(), pageUrl,
          attention: { policy: 'search', version: 1, kind: 'observation', reason: 'title_present' }, evidence: [], limitation: '', guidance: '' }],
      } }] }))
    const fact = () => overlayCategoryCoverage(base(), applicableCategoryEvidence([audit], baseline), now).find(fact => fact.area === 'search')
    const provider = audit.verifierExecutions.find(row => row.workKind === 'google')!
    provider.status = 'FAILED'
    provider.workState = 'EXHAUSTED'
    audit.failedModules = ['google', 'search-google-index']
    expect(fact()).toMatchObject({ state: 'healthy', evidenced: true })
    provider.status = 'PENDING'
    provider.workState = 'WAITING'
    expect(fact()).toMatchObject({ state: 'unknown', evidenced: false })
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
