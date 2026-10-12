import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  provisionalFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  improvementFindMany: vi.fn(),
  auditPageFindMany: vi.fn(),
  screenshotFindMany: vi.fn(),
  flagFindMany: vi.fn(),
  outcomeFindMany: vi.fn(),
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
  },
}))

import { loadSiteSummaries } from '@/lib/sites/application/list-sites'

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
      { id: 'site-1', name: 'One', canonicalHost: 'one.example', updatedAt: new Date('2026-10-01'), watchInterval: null, watchNextRunAt: null, watchLastError: null, watchConsecutiveFailures: 0 },
      { id: 'site-2', name: 'Two', canonicalHost: 'two.example', updatedAt: new Date('2026-10-02'), watchInterval: 'WEEKLY', watchNextRunAt: new Date('2026-10-10'), watchLastError: null, watchConsecutiveFailures: 0 },
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
      if ('failedModules' in overrides) expect(site.presentation.run).toMatchObject({ state: 'partial', recoveryAction: 'retry' })
    }
  })

  it('keeps failed pages incomplete and confirmed Flags actionable', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    mocks.auditPageFindMany.mockResolvedValue([{ auditId: audit.id, status: 'FAILED' }])
    expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state).toBe('could_not_verify')
    mocks.flagFindMany.mockResolvedValue([{ auditId: audit.id, fingerprint: 'broken-link', severity: 'IMPORTANT', confidence: 1,
      pageUrl: 'https://one.example/', checkId: 'broken-internal-links', rubric: 'REACH', impactTag: 'SEO' }])
    expect((await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')?.presentation.result.state).toBe('flags')
  })
  it('batches recovery proof and keeps the two owned Sites independent', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValueOnce([audit]).mockResolvedValueOnce([audit])
      .mockResolvedValueOnce([{ id: 'recovery', projectId: 'site-1', completedAt: new Date() }])
    const flag = { status: 'FIXED', resolvedInId: 'recovery', severity: 'IMPORTANT', confidence: 1,
      pageUrl: 'https://one.example/', checkId: 'title-missing', rubric: 'REACH', impactTag: 'SEO' }
    mocks.improvementFindMany.mockResolvedValue(['site-1', 'site-2'].map(projectId => ({ projectId, fingerprint: 'title', outcomeId: null,
      occurrences: [{ flag }] })))
    const sites = await loadSiteSummaries('user-1')
    expect(sites.find(site => site.id === 'site-1')?.presentation.flags.count).toBe(0)
    expect(sites.find(site => site.id === 'site-2')?.presentation.flags.count).toBe(1)
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(3)
  })
  it('does not turn a current broad check Clear when an enabled watched result is unavailable', async () => {
    const audit = completedAudit()
    mocks.auditFindMany.mockReset().mockResolvedValue([audit])
    mocks.outcomeFindMany.mockResolvedValue([{ projectId: 'site-1', enabled: true, assessments: [
      { state: 'COULD_NOT_VERIFY', validUntil: new Date(Date.now() + 60_000) },
    ] }])
    const site = (await loadSiteSummaries('user-1')).find(site => site.id === 'site-1')!
    expect(site.presentation.result.state).toBe('could_not_verify')
    expect(mocks.outcomeFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.outcomeFindMany.mock.calls[0][0].where).toMatchObject({ projectId: { in: ['site-2', 'site-1'].sort() }, enabled: true })
  })
})
