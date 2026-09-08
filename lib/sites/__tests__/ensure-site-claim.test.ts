import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = vi.hoisted(() => ({
  provisionalSite: { findMany: vi.fn(), updateMany: vi.fn() },
  sitePage: { findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn(), delete: vi.fn() },
  siteOutcome: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  siteOutcomePage: { updateMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import {
  claimProvisionalSitesForProject,
  migrateProvisionalSiteDataToProject,
} from '@/lib/sites/ensure-site'

describe('claim provisional Site data', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('claims only provisionals tied to the audit ids', async () => {
    prismaMock.provisionalSite.updateMany.mockResolvedValue({ count: 1 })
    await claimProvisionalSitesForProject({
      userId: 'u1',
      projectId: 'proj_1',
      canonicalHost: 'example.com',
      primaryAuditIds: ['audit-1'],
    })
    expect(prismaMock.provisionalSite.updateMany).toHaveBeenCalledWith({
      where: {
        canonicalHost: 'example.com',
        claimedProjectId: null,
        OR: [{ primaryAuditId: { in: ['audit-1'] } }],
      },
      data: { claimedProjectId: 'proj_1' },
    })
  })

  it('moves provisional outcomes onto the project and keeps confirmation', async () => {
    prismaMock.provisionalSite.findMany.mockResolvedValue([{ id: 'prov_1' }])
    prismaMock.sitePage.findMany.mockResolvedValue([])
    prismaMock.siteOutcome.findMany.mockResolvedValue([
      {
        id: 'out_1',
        slug: 'primary-path',
        name: 'Buy',
        description: null,
        inferenceSource: 'user',
        confirmedAt: new Date('2026-09-08'),
      },
    ])
    prismaMock.siteOutcome.findFirst.mockResolvedValue(null)
    prismaMock.siteOutcome.update.mockResolvedValue({})

    await migrateProvisionalSiteDataToProject({
      projectId: 'proj_1',
      canonicalHost: 'example.com',
      primaryAuditIds: ['audit-1'],
    })

    expect(prismaMock.siteOutcome.update).toHaveBeenCalledWith({
      where: { id: 'out_1' },
      data: { projectId: 'proj_1', provisionalSiteId: null },
    })
  })
})
