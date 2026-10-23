import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  audit: { findUniqueOrThrow: vi.fn() },
  provisionalSite: { findFirst: vi.fn() },
}))
const loadSiteRecord = vi.hoisted(() => vi.fn())
const syncOutcomesFromAudit = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/sites/ensure-site', () => ({ loadSiteRecord }))
vi.mock('@/lib/sites/outcomes', () => ({ syncOutcomesFromAudit }))
vi.mock('@/lib/analytics/site-events', () => ({ recordSiteLifecycleEvent: vi.fn(async () => undefined) }))

import { projectSiteAnalysis } from '@/lib/sites/application/project-analysis'

describe('projectSiteAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loadSiteRecord.mockResolvedValue({ projectId: null, provisionalSiteId: 'prov_1', url: 'https://example.com/' })
    syncOutcomesFromAudit.mockResolvedValue(undefined)
  })

  it('keeps a claimed anonymous analysis on the provisional that recorded it', async () => {
    prismaMock.audit.findUniqueOrThrow.mockResolvedValue({
      projectId: null,
      userId: null,
      url: 'https://example.com/',
      executionSpec: null,
    })
    prismaMock.provisionalSite.findFirst.mockResolvedValue({ id: 'prov_1', sessionKey: 'anon-v1:browser' })

    await projectSiteAnalysis('audit-1')

    expect(loadSiteRecord).toHaveBeenCalledWith('p_prov_1', { viewer: { sessionKey: 'anon-v1:browser' } })
    expect(syncOutcomesFromAudit).toHaveBeenCalledWith({
      site: expect.objectContaining({ provisionalSiteId: 'prov_1' }),
      auditId: 'audit-1',
      url: 'https://example.com/',
    })
  })

  it('loads an owned analysis by its project', async () => {
    prismaMock.audit.findUniqueOrThrow.mockResolvedValue({
      projectId: 'proj_1',
      userId: 'owner',
      url: 'https://example.com/',
      executionSpec: null,
    })
    prismaMock.provisionalSite.findFirst.mockResolvedValue({ id: 'prov_1' })
    loadSiteRecord.mockResolvedValue({ projectId: 'proj_1', provisionalSiteId: null, url: 'https://example.com/' })

    await projectSiteAnalysis('audit-1')

    expect(loadSiteRecord).toHaveBeenCalledWith('proj_1', undefined)
  })
})
