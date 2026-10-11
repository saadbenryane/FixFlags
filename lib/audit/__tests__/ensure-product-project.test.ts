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
const ensureDefaultMonitoring = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({ prisma: prismaMock }))
vi.mock('@/lib/billing/product-capacity', () => ({ assertCanCreateProduct }))
vi.mock('@/lib/sites/application/default-monitoring', () => ({ ensureDefaultMonitoring }))

import { ensureProductProject } from '@/lib/audit/ensure-product-project'

describe('ensureProductProject', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.$transaction.mockImplementation(async (operation) => operation(prismaMock))
    prismaMock.project.findUnique.mockResolvedValue(null)
    assertCanCreateProduct.mockResolvedValue(undefined)
  })

  it('checks capacity before restoring a removed website', async () => {
    prismaMock.project.findUnique.mockResolvedValue({ id: 'old-site', productIntelligence: null, deletedAt: new Date() })
    assertCanCreateProduct.mockRejectedValue(new Error('One website during open beta'))
    await expect(ensureProductProject('user-1', 'https://example.com')).rejects.toThrow('One website during open beta')
    expect(prismaMock.project.update).not.toHaveBeenCalled()
  })

  it('uses the unique Product identity for concurrent claims', async () => {
    prismaMock.project.upsert.mockResolvedValue({ id: 'anchor-1', productIntelligence: null })

    const project = await ensureProductProject('user-1', 'https://example.com/path')
    expect(project.id).toBe('anchor-1')
    expect(ensureDefaultMonitoring).toHaveBeenCalledWith(prismaMock, 'anchor-1', 'user-1')
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
