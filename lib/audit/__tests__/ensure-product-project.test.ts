import { beforeEach, describe, expect, it, vi } from 'vitest'
const prismaMock = vi.hoisted(() => ({
  $transaction: vi.fn(),
  project: {
    findUnique: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
  },
}))
const assertCanCreateProduct = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/billing/product-capacity', () => ({ assertCanCreateProduct }))

import { ensureProductProject } from '@/lib/audit/ensure-product-project'

describe('ensureProductProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (operation) => operation(prismaMock))
    prismaMock.project.findUnique.mockResolvedValue(null)
    assertCanCreateProduct.mockResolvedValue(undefined)
  })

  it('uses the unique Product identity for concurrent claims', async () => {
    prismaMock.project.upsert.mockResolvedValue({ id: 'anchor-1', productIntelligence: null })

    const project = await ensureProductProject('user-1', 'https://example.com/path')
    expect(project.id).toBe('anchor-1')
    expect(assertCanCreateProduct).toHaveBeenCalledWith(prismaMock, 'user-1')
    expect(prismaMock.project.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId_canonicalHost: { userId: 'user-1', canonicalHost: 'example.com' },
        },
      })
    )
  })

  it('reuses an existing Product without spending Product capacity', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'anchor-1', productIntelligence: null })
    prismaMock.project.update.mockResolvedValue({ id: 'anchor-1', productIntelligence: null })

    await ensureProductProject('user-1', 'https://example.com/updated')

    expect(assertCanCreateProduct).not.toHaveBeenCalled()
    expect(prismaMock.project.upsert).not.toHaveBeenCalled()
  })
})
