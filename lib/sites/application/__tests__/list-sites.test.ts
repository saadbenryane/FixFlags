import { beforeEach, describe, expect, it, vi } from 'vitest'
import { healthyDesktopPs, pageSpeedMeasurementFixture } from '@/lib/audit/__tests__/check-fixtures'
import { runPerformanceChecks } from '@/lib/audit/checks/performance'
import { scopePerformanceAssertions } from '@/lib/audit/performance-measurement'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  provisionalFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  improvementFindMany: vi.fn(),
  auditPageFindMany: vi.fn(),
  screenshotFindMany: vi.fn(),
  flagFindMany: vi.fn(),
  outcomeFindMany: vi.fn(),
  fixtureFindMany: vi.fn(),
  categoryIds: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    $queryRaw: mocks.categoryIds,
    provisionalSite: { findMany: mocks.provisionalFindMany },
    project: { findMany: mocks.projectFindMany },
    audit: { findMany: mocks.auditFindMany },
    improvement: { findMany: mocks.improvementFindMany },
    auditPage: { findMany: mocks.auditPageFindMany },
    screenshot: { findMany: mocks.screenshotFindMany },
    flag: { findMany: mocks.flagFindMany },
    siteOutcome: { findMany: mocks.outcomeFindMany },
    outcomeFixture: { findMany: mocks.fixtureFindMany },
  },
}))

import { loadSiteSummaries } from '@/lib/sites/application/list-sites'
// These fixtures exercise assessment interpretation; native cases verify the ID selection.
vi.mock('@/lib/sites/application/outcome-references', () => ({ loadOutcomeSummaryReferencesForProjects: async () => [
  { id: 'outcome-1', assessmentIds: ['assessment-1'] }, { id: 'outcome-2', assessmentIds: ['assessment-2'] },
] }))

function observed(module: string, keys: string[]) {
  return { targetKey: 'module:' + module, status: 'COMPLETED', detail: {
    kind: 'site-module-check', version: 1, module, pageUrl: 'https://one.example/', passed: true, applicable: true,
    assertions: keys.map(key => ({ key, name: key, expected: 'Present', observed: 'Observed', passed: true })),
  } }
}
function completedAudit(overrides: Record<string, unknown> = {}) {
  return { id: 'audit-1', projectId: 'site-1', status: 'COMPLETED', startedAt: new Date(), completedAt: new Date(),
    failureCode: null, failedModules: [], reportCompleteness: 'FULL', updatedAt: new Date(),
    evidenceCoverage: { metadata: true, desktopPageSpeed: true, flowScan: true },
    verifierExecutions: [observed('security', ['https', 'image-transport']), observed('measurement', ['analytics-markup'])],
    ...overrides }
}

describe('loadSiteSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.categoryIds.mockResolvedValue([])
    mocks.provisionalFindMany.mockResolvedValue([])
    mocks.projectFindMany.mockResolvedValue([
      { id: 'site-1', url: 'https://one.example/', deletedAt: null, user: { id: 'user-1', lifecycleStatus: 'ACTIVE' }, uptimeMonitor: null,
        name: 'One', canonicalHost: 'one.example', updatedAt: new Date('2026-10-01'), watchInterval: null, watchNextRunAt: null, watchLastError: null, watchConsecutiveFailures: 0 },
      { id: 'site-2', url: 'https://two.example/', deletedAt: null, user: { id: 'user-1', lifecycleStatus: 'ACTIVE' }, uptimeMonitor: null,
        name: 'Two', canonicalHost: 'two.example', updatedAt: new Date('2026-10-02'), watchInterval: 'WEEKLY', watchNextRunAt: new Date(Date.now() + 7 * 86400_000), watchLastError: null, watchConsecutiveFailures: 0 },
    ])
    const audits = [
      { id: 'audit-1', projectId: 'site-1', status: 'COMPLETED', startedAt: new Date('2026-10-01'), completedAt: new Date('2026-10-01'), failureCode: null, evidenceCoverage: null, updatedAt: new Date('2026-10-01') },
      { id: 'audit-2', projectId: 'site-2', status: 'COMPLETED', startedAt: new Date('2026-10-02'), completedAt: new Date('2026-10-02'), failureCode: null, evidenceCoverage: null, updatedAt: new Date('2026-10-02') },
    ]
    mocks.auditFindMany.mockResolvedValueOnce(audits).mockResolvedValueOnce(audits)
    mocks.improvementFindMany.mockResolvedValue([])
    mocks.auditPageFindMany.mockResolvedValue([
      { auditId: 'audit-1', status: 'COMPLETED' },
      { auditId: 'audit-2', status: 'COMPLETED' },
    ])
    mocks.screenshotFindMany.mockResolvedValue([])
    mocks.flagFindMany.mockResolvedValue([])
    mocks.outcomeFindMany.mockResolvedValue([])
    mocks.fixtureFindMany.mockResolvedValue([])
  })

  it('uses a constant batch of summary reads and never turns missing evidence green', async () => {
    const sites = await loadSiteSummaries('user-1')

    expect(sites).toHaveLength(2)
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(2)
    expect(mocks.improvementFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.auditPageFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.screenshotFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.flagFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.outcomeFindMany).toHaveBeenCalledTimes(1)
    expect(sites.every((site) => site.presentation.result.state === 'could_not_verify')).toBe(true)
    expect(sites.find((site) => site.id === 'site-2')?.presentation.monitoring.label).toBe('Weekly')
  })

  it('requires the same required-area evidence as the Site home, rather than any current observation', async () => {
    for (const overrides of [
      {},
      { evidenceCoverage: { metadata: true } },
      { failedModules: ['flow'], reportCompleteness: 'PARTIAL' },
      { failedModules: ['browser'], reportCompleteness: 'PARTIAL', evidenceCoverage: {} },
      { verifierExecutions: [...completedAudit().verifierExecutions, { targetKey: 'module:flow', status: 'COMPLETED', detail: {
        ...observed('flow', ['primary-action-presence']).detail, complete: false,
      } }] },
      { verifierExecutions: [...completedAudit().verifierExecutions, { targetKey: 'module:search-presentation', status: 'COMPLETED', detail: {
        kind: 'search-checks', version: 1, auditId: 'audit-1', pageUrl: 'https://one.example/',
        collectedAt: new Date().toISOString(), complete: true, observations: [],
      } }] },
      { verifierExecutions: [completedAudit().verifierExecutions[0], { ...observed('measurement', ['analytics-markup']), detail: {
        ...observed('measurement', ['analytics-markup']).detail,
        execution: { auditId: 'audit-1', taskId: 'tracking', checkVersion: 1, source: 'browser-network', collectedAt: new Date().toISOString() },
      } }] },
    ]) {
      const audit = completedAudit(overrides)
      mocks.auditFindMany.mockReset().mockResolvedValueOnce([audit]).mockResolvedValueOnce([audit])
      const site = (await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')!
      expect(site.presentation.result.state).toBe(Object.keys(overrides).length ? 'could_not_verify' : 'clear')
      if (Array.isArray(overrides.failedModules) && overrides.failedModules.includes('browser')) {
        expect(site.presentation.run).toMatchObject({ state: 'partial', recoveryAction: 'retry' })
      } else if ('failedModules' in overrides) expect(site.presentation.run).toMatchObject({ state: 'idle', recoveryAction: null })
    }
  })

  it('keeps failed pages incomplete and confirmed Flags actionable', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    mocks.auditPageFindMany.mockResolvedValue([{ auditId: audit.id, status: 'FAILED' }])
    expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state).toBe('could_not_verify')
    mocks.flagFindMany.mockResolvedValue([{ id: 'unbound', status: 'OPEN', audit: { projectId: 'site-1' }, auditId: audit.id, fingerprint: 'broken-link', severity: 'IMPORTANT', confidence: 1,
      pageUrl: 'https://one.example/', checkId: 'broken-internal-links', rubric: 'REACH', impactTag: 'SEO' }])
    expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state).toBe('flags')
  })
  it('does not certify a progressive analysis whose finding comparison has not been published', async () => {
    const audit = completedAudit({ executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
      targetUrl: 'https://one.example/', environment: 'production', checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null } })
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    mocks.auditPageFindMany.mockResolvedValue([{ auditId: audit.id, url: 'https://one.example/', status: 'COMPLETED' }])
    expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state).toBe('could_not_verify')
  })
  it('counts missing admitted and discovered pages in coverage without inventing a finding', async () => {
    const targetUrl = 'https://one.example/', peer = targetUrl + 'pricing'
    const executionSpec = { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl, environment: 'production',
      monitoringPages: [targetUrl, peer], checks: { 'no-https': 1 }, outcomes: [], verificationTarget: null }
    const audit = completedAudit({ executionSpec })
    mocks.auditPageFindMany.mockResolvedValue([{ auditId: audit.id, url: targetUrl, status: 'COMPLETED' }])
    for (const source of [audit, { ...audit, executionSpec: { ...executionSpec, monitoringPages: undefined },
      verifierExecutions: [...audit.verifierExecutions, { targetKey: 'task:p1:browser', workKind: 'browser', status: 'FAILED', pageUrl: peer }] }]) {
      mocks.auditFindMany.mockReset().mockResolvedValue([source])
      const site = (await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')!
      expect(site.presentation.coverage).toMatchObject({ pagesReached: 1, pagesExpected: 2, complete: false })
      expect(site.presentation.result.state).toBe('could_not_verify')
      expect(site.presentation.flags.count).toBe(0)
    }
  })
  it('batches recovery proof and keeps the two owned Sites independent', async () => {
    const audit = completedAudit()
    const measurement = healthyDesktopPs({ lcp: 3000, diagnostics: { measurement: pageSpeedMeasurementFixture('https://one.example/') } })
    mocks.auditFindMany.mockReset().mockResolvedValueOnce([audit]).mockResolvedValueOnce([audit])
      .mockResolvedValueOnce([{ id: 'recovery', projectId: 'site-1', completedAt: new Date(),
        executionSpec: { engine: 'progressive-v1', version: 1, targetUrl: 'https://one.example/', environment: 'production', scope: 'SITE',
          checks: { 'lcp-poor': 1 }, outcomes: [], verificationTarget: null },
        verifierExecutions: [{ targetKey: 'module:performance', status: 'COMPLETED', detail: {
          kind: 'site-module-check', version: 1, module: 'performance', pageUrl: 'https://one.example/', applicable: true, passed: true,
          assertions: scopePerformanceAssertions(measurement, 'https://one.example/',
            [{ key: 'lcp', name: 'LCP', expected: 'At most 2500ms', observed: '1000ms', passed: true, complete: true }]),
          execution: { auditId: 'recovery', taskId: 'speed', checkVersion: 1, source: 'pagespeed-desktop', collectedAt: new Date().toISOString() },
        } }],
      }])
    const flag = { id: 'source-flag', auditId: 'source-audit', status: 'FIXED', resolvedInId: 'recovery', severity: 'IMPORTANT', confidence: 1,
      pageUrl: 'https://one.example/', ...runPerformanceChecks(measurement, null, 'https://one.example/')[0], rubric: 'PERFORMANCE', impactTag: 'PERFORMANCE' }
    mocks.improvementFindMany.mockResolvedValue(['site-1', 'site-2'].map(projectId => ({ projectId, fingerprint: 'title', outcomeId: null,
      occurrences: [{ flag }] })))
    const sites = await loadSiteSummaries('user-1')
    expect(sites.find(site => site.id === 'site-1')?.presentation.flags.count).toBe(0)
    expect(sites.find(site => site.id === 'site-2')?.presentation.flags.count).toBe(1)
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(3)
  })
  it('counts an unresolved newer occurrence even when the repair workflow is Verified', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    const flag = { id: 'later-flag', auditId: 'later-source', status: 'OPEN', resolvedInId: null, severity: 'IMPORTANT', confidence: 1,
      pageUrl: 'https://one.example/', checkId: 'broken-internal-links', rubric: 'REACH', impactTag: 'SEO' }
    mocks.improvementFindMany.mockResolvedValue([{ projectId: 'site-1', status: 'VERIFIED', fingerprint: 'broken-link', outcomeId: null,
      occurrences: [{ flag }], attempts: [{ outcome: 'IMPROVED', comparable: true, sourceAuditId: 'older-source', verificationAuditId: 'repair',
        verificationAudit: { id: 'repair', projectId: 'site-1', parentId: 'older-source', status: 'COMPLETED' } }] }])
    const site = (await loadSiteSummaries('user-1')).find(value => value.id === 'site-1')!
    expect(site.presentation.flags.count).toBe(1)
    expect(site.presentation.result.state).toBe('flags')
  })
  it('does not turn a current broad check Clear when an enabled watched result is unavailable', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    mocks.outcomeFindMany.mockResolvedValue([{ projectId: 'site-1', enabled: true, environment: 'production', bindings: [], assessments: [
      { state: 'COULD_NOT_VERIFY', validUntil: new Date(Date.now() + 60_000) },
    ] }])
    const site = (await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')!
    expect(site.presentation.result.state).toBe('could_not_verify')
    expect(mocks.outcomeFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.outcomeFindMany.mock.calls[0][0].where).toMatchObject({ projectId: { in: ['site-2', 'site-1'].sort() }, enabled: true })
  })

  it('uses current binding revisions before presenting a fresh watched result as Clear', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    const binding = { key: 'http', required: true, mechanism: 'HTTP_AVAILABILITY', version: 2, config: {} }
    const coverage = { environment: 'production', requiredBindings: ['http'], bindings: [binding] }
    const outcome = { projectId: 'site-1', enabled: true, environment: 'production', staleAfterMinutes: 60, bindings: [binding], assessments: [
      { state: 'CLEAR', assessedAt: new Date(), validUntil: new Date(Date.now() + 60_000), coverage },
    ] }
    for (const changed of [outcome, { ...outcome, environment: 'staging' }, { ...outcome, bindings: [{ ...binding, version: 3 }] },
      { ...outcome, bindings: [] }, { ...outcome, assessments: [{ ...outcome.assessments[0], coverage: {} }] }]) {
      mocks.outcomeFindMany.mockResolvedValue([changed])
      expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state)
        .toBe(changed === outcome ? 'clear' : 'could_not_verify')
    }
    expect(mocks.fixtureFindMany).not.toHaveBeenCalled()
  })

  it('requires current Site-owned fixture authority while retaining one batch for every Site', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    const binding = { key: 'signup', required: true, mechanism: 'SAFE_FORM', version: 1, config: { fixtureId: 'fixture' } }
    const coverage = { environment: 'production', requiredBindings: ['signup'], bindings: [{ ...binding, fixture: { id: 'fixture', version: 4 } }] }
    mocks.outcomeFindMany.mockResolvedValue(['site-1', 'site-2'].map(projectId => ({ projectId, enabled: true, environment: 'production', staleAfterMinutes: 60,
      bindings: [binding], assessments: [{ state: 'CLEAR', assessedAt: new Date(), validUntil: new Date(Date.now() + 60_000), coverage }] })))
    const fixture = { id: 'fixture', projectId: 'site-1', configuredByUserId: 'user-1', project: { userId: 'user-1' }, version: 4, enabled: true, authorizedAt: new Date(), lastDryRunVersion: 4 }
    for (const changed of [fixture, { ...fixture, version: 5 }, { ...fixture, enabled: false }, { ...fixture, authorizedAt: null },
      { ...fixture, projectId: 'site-2' }, { ...fixture, project: { userId: 'new-owner' } }]) {
      mocks.fixtureFindMany.mockClear().mockResolvedValue([changed])
      expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state)
        .toBe(changed === fixture ? 'clear' : 'could_not_verify')
      expect(mocks.fixtureFindMany).toHaveBeenCalledTimes(1)
      expect(mocks.fixtureFindMany.mock.calls[0][0].where).toEqual({ OR: [{ projectId: 'site-1', id: 'fixture' }, { projectId: 'site-2', id: 'fixture' }] })
    }
  })
})
