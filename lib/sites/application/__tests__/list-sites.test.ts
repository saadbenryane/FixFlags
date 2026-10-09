import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  projectFindMany: vi.fn(),
  auditFindMany: vi.fn(),
  improvementFindMany: vi.fn(),
  auditPageFindMany: vi.fn(),
  screenshotFindMany: vi.fn(),
  flagFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  prisma: {
    project: { findMany: mocks.projectFindMany },
    audit: { findMany: mocks.auditFindMany },
    improvement: { findMany: mocks.improvementFindMany },
    auditPage: { findMany: mocks.auditPageFindMany },
    screenshot: { findMany: mocks.screenshotFindMany },
    flag: { findMany: mocks.flagFindMany },
  },
}))

import { loadSiteSummaries } from '@/lib/sites/application/list-sites'

describe('loadSiteSummaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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
  })

  it('uses a constant batch of summary reads and never turns missing evidence green', async () => {
    const sites = await loadSiteSummaries('user-1')

    expect(sites).toHaveLength(2)
    expect(mocks.auditFindMany).toHaveBeenCalledTimes(2)
    expect(mocks.improvementFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.auditPageFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.screenshotFindMany).toHaveBeenCalledTimes(1)
    expect(mocks.flagFindMany).toHaveBeenCalledTimes(1)
    expect(sites.every((site) => site.presentation.result.state === 'could_not_verify')).toBe(true)
    expect(sites.find((site) => site.id === 'site-2')?.presentation.monitoring.label).toBe('Weekly')
  })
})
