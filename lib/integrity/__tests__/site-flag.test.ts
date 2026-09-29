import { beforeEach, describe, expect, it, vi } from 'vitest'
import { upsertIntegritySiteFlag } from '../site-flag'

const prisma = vi.hoisted(() => ({
  project: { findUnique: vi.fn() },
  improvement: { upsert: vi.fn(), updateMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn() } }))

describe('integrity Site Flag', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('upserts a conversion Flag on a matching Site when customers cannot buy', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_1' })
    prisma.improvement.upsert.mockResolvedValue({})
    const result = await upsertIntegritySiteFlag({
      projectId: 'proj_1',
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

  /**
   * A single GREEN probe is an observation, not a recovery. `VERIFIED` on an
   * Improvement means FixFlags proved the flagged behaviour was restored by a fresh
   * comparable execution, and that proof is what the Site Agent and run reconciliation
   * read when they tell a customer a Flag is fixed. A scheduled path probe walks one
   * URL, so a flake, a redirect, or a consent interstitial could have resolved a Flag
   * the customer was told stays open until the same page and action pass.
   *
   * So the probe leaves recovery state alone. Resolution is the Verify path's job.
   */
  it('does not claim a recovery from a single GREEN probe', async () => {
    prisma.project.findUnique.mockResolvedValue({ id: 'proj_1' })
    prisma.improvement.updateMany.mockResolvedValue({ count: 1 })
    await upsertIntegritySiteFlag({
      projectId: 'proj_1',
      pathId: 'path_1',
      pathLabel: 'Blue mug',
      storefrontUrl: 'https://everydaygoods.example/products/mug',
      health: 'GREEN',
      reason: 'ok',
    })
    expect(prisma.improvement.updateMany).not.toHaveBeenCalled()
    expect(prisma.improvement.upsert).not.toHaveBeenCalled()
  })
})
