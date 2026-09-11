import { describe, expect, it, vi } from 'vitest'
import { upsertIntegritySiteFlag } from '../site-flag'

const prisma = vi.hoisted(() => ({
  project: { findFirst: vi.fn() },
  improvement: { upsert: vi.fn(), updateMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

describe('integrity Site Flag', () => {
  it('upserts a conversion Flag on a matching Site when customers cannot buy', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'proj_1' })
    prisma.improvement.upsert.mockResolvedValue({})
    const result = await upsertIntegritySiteFlag({
      shop: { primaryUrl: 'https://everydaygoods.example' },
      pathId: 'path_1',
      pathLabel: 'Blue mug',
      storefrontUrl: 'https://everydaygoods.example/products/mug',
      health: 'RED',
      reason: 'checkout_blocked',
    })
    expect(result).toEqual({ projectId: 'proj_1' })
    expect(prisma.improvement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { projectId_fingerprint: { projectId: 'proj_1', fingerprint: 'integrity:path_1' } },
        create: expect.objectContaining({
          title: "Customers can't buy: Blue mug",
          status: 'PROPOSED',
        }),
      })
    )
  })

  it('marks the Flag verified when the path recovers', async () => {
    prisma.project.findFirst.mockResolvedValue({ id: 'proj_1' })
    prisma.improvement.updateMany.mockResolvedValue({ count: 1 })
    await upsertIntegritySiteFlag({
      shop: { primaryUrl: 'https://everydaygoods.example' },
      pathId: 'path_1',
      pathLabel: 'Blue mug',
      storefrontUrl: 'https://everydaygoods.example/products/mug',
      health: 'GREEN',
      reason: 'ok',
    })
    expect(prisma.improvement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'VERIFIED' },
      })
    )
  })
})
