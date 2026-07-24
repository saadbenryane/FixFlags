import { beforeEach, describe, expect, it, vi } from 'vitest'

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    technology: { upsert: vi.fn() },
    siteTechnology: {
      updateMany: vi.fn(),
      upsert: vi.fn(),
    },
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { reconcileSiteTechnologies } from '@/lib/graph/persist'

describe('current site technology reconciliation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.technology.upsert.mockResolvedValue({ id: 'tech_1' })
  })

  it('marks the previous current set inactive before a complete snapshot', async () => {
    await reconcileSiteTechnologies('site_1', [], true)
    expect(prismaMock.siteTechnology.updateMany).toHaveBeenCalledWith({
      where: { siteId: 'site_1', isCurrent: true },
      data: { isCurrent: false },
    })
  })

  it('never infers removals from a partial snapshot', async () => {
    await reconcileSiteTechnologies('site_1', [], false)
    expect(prismaMock.siteTechnology.updateMany).not.toHaveBeenCalled()
  })

  it('upserts detected technologies as current with refreshed confidence', async () => {
    await reconcileSiteTechnologies(
      'site_1',
      [{
        name: 'Next.js',
        kind: 'framework',
        confidence: 0.95,
        evidence: [],
      }],
      true
    )
    expect(prismaMock.siteTechnology.upsert).toHaveBeenCalledWith({
      where: {
        siteId_technologyId: {
          siteId: 'site_1',
          technologyId: 'tech_1',
        },
      },
      create: expect.objectContaining({
        siteId: 'site_1',
        technologyId: 'tech_1',
        confidence: 0.95,
        isCurrent: true,
      }),
      update: expect.objectContaining({
        confidence: { set: 0.95 },
        isCurrent: true,
      }),
    })
  })
})
