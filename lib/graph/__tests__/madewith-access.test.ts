import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  prismaMock,
  canSharePubliclyMock,
  loadTechnologyProfileMock,
} = vi.hoisted(() => ({
  prismaMock: {
    site: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    audit: {
      findMany: vi.fn(),
    },
  },
  canSharePubliclyMock: vi.fn(),
  loadTechnologyProfileMock: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/auth/entitlements', () => ({
  canSharePublicly: canSharePubliclyMock,
}))
vi.mock('@/lib/audit/technology-profile', () => ({
  loadTechnologyProfile: loadTechnologyProfileMock,
}))

import { getMadewithPage } from '@/lib/graph/queries'

describe('/madewith public access', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.site.findUnique.mockResolvedValue({
      id: 'site_1',
      hostname: 'example.com',
      rootUrl: 'https://example.com',
      industryGuess: 'SaaS',
      technologies: [{
        technologyId: 'tech_1',
        technology: { name: 'Next.js' },
      }],
    })
    prismaMock.site.findMany.mockResolvedValue([])
    loadTechnologyProfileMock.mockResolvedValue({
      status: 'complete',
      detectorVersion: 'v1',
      detectedAt: '2026-07-23T10:00:00.000Z',
      technologies: [{
        slug: 'next-js',
        name: 'Next.js',
        category: 'framework',
        confidenceBand: 'verified',
        evidence: [],
      }],
      insight: null,
    })
  })

  it('does not publish a profile when there is no explicitly public eligible audit', async () => {
    prismaMock.audit.findMany.mockResolvedValue([])
    expect(await getMadewithPage('example.com')).toBeNull()
    expect(loadTechnologyProfileMock).not.toHaveBeenCalled()
  })

  it('does not publish a revoked or ineligible owner audit', async () => {
    prismaMock.audit.findMany.mockResolvedValue([{
      id: 'audit_1',
      score: 80,
      url: 'https://example.com',
      completedAt: new Date(),
      user: { id: 'user_1', role: 'user', plan: 'TEAM', subscriptionStatus: 'CANCELED' },
      rubrics: [],
      flags: [],
      _count: { flags: 2 },
    }])
    canSharePubliclyMock.mockReturnValue(false)
    expect(await getMadewithPage('example.com')).toBeNull()
  })

  it('publishes only the audit-owned sanitized profile for an eligible owner', async () => {
    prismaMock.audit.findMany.mockResolvedValue([{
      id: 'audit_1',
      score: 80,
      url: 'https://example.com',
      completedAt: new Date('2026-07-23T10:00:00Z'),
      user: { id: 'user_1', role: 'user', plan: 'TEAM', subscriptionStatus: 'ACTIVE' },
      rubrics: [],
      flags: [],
      _count: { flags: 2 },
    }])
    canSharePubliclyMock.mockReturnValue(true)

    const result = await getMadewithPage('example.com')
    expect(result?.lastAudit.id).toBe('audit_1')
    expect(result?.technologyProfile.technologies[0]?.name).toBe('Next.js')
    expect(loadTechnologyProfileMock).toHaveBeenCalledWith(
      'audit_1',
      expect.objectContaining({ score: 80 })
    )
  })

  it('rejects invalid hostname parameters before querying', async () => {
    expect(await getMadewithPage('example.com/secret')).toBeNull()
    expect(prismaMock.site.findUnique).not.toHaveBeenCalled()
  })
})
