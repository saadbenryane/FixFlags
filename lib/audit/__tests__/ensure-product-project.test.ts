import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'

const prismaMock = vi.hoisted(() => ({
  project: {
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { ensureProductProject } from '@/lib/audit/ensure-product-project'

describe('ensureProductProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('reuses the unique anchor created by a concurrent claim', async () => {
    prismaMock.project.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'anchor-1', productIntelligence: null })
    prismaMock.project.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique anchor', {
        code: 'P2002',
        clientVersion: '6.0.0',
      })
    )

    const project = await ensureProductProject('user-1', 'https://example.com/path')
    expect(project.id).toBe('anchor-1')
    expect(prismaMock.project.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.project.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { userId: 'user-1', url: 'https://example.com', isAnchor: true } })
    )
  })
})
