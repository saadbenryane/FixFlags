import { beforeEach, describe, expect, it, vi } from 'vitest'
const prismaMock = vi.hoisted(() => ({
  project: {
    upsert: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))

import { ensureProductProject } from '@/lib/audit/ensure-product-project'

describe('ensureProductProject', () => {
  beforeEach(() => vi.clearAllMocks())

  it('uses the unique Product identity for concurrent claims', async () => {
    prismaMock.project.upsert.mockResolvedValue({ id: 'anchor-1', productIntelligence: null })

    const project = await ensureProductProject('user-1', 'https://example.com/path')
    expect(project.id).toBe('anchor-1')
    expect(prismaMock.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_canonicalHost: { userId: 'user-1', canonicalHost: 'example.com' },
        },
      })
    )
  })
})
