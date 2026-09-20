import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  $transaction: vi.fn(),
  project: { findFirst: vi.fn() },
  shopifyAccountLink: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  shopifyShop: { findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  $executeRaw: vi.fn(),
}))

vi.mock('@/lib/db', () => ({ prisma }))

import {
  consumeShopifyAccountLink,
  createShopifyAccountLink,
} from '@/lib/shopify/account-link'

describe('Shopify account links', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.$transaction.mockImplementation((callback: (tx: typeof prisma) => unknown) => callback(prisma))
    prisma.project.findFirst.mockResolvedValue({ id: 'project-1' })
    prisma.shopifyAccountLink.create.mockResolvedValue({ id: 'link-1' })
  })

  it('issues a short-lived opaque link only for an owned Site', async () => {
    const token = await createShopifyAccountLink({ projectId: 'project-1', userId: 'user-1' })
    expect(token.length).toBeGreaterThan(30)
    expect(prisma.project.findFirst).toHaveBeenCalledWith({
      where: { id: 'project-1', userId: 'user-1' },
      select: { id: true },
    })
    expect(prisma.shopifyAccountLink.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ projectId: 'project-1', userId: 'user-1', tokenHash: expect.any(String) }),
    })
  })

  it('refuses to claim a store already linked to another Site', async () => {
    prisma.shopifyAccountLink.findUnique.mockResolvedValue({
      id: 'link-1', projectId: 'project-1', consumedAt: null, expiresAt: new Date(Date.now() + 60_000),
    })
    prisma.shopifyShop.findFirst.mockResolvedValueOnce({ id: 'shop-1', projectId: 'project-2' })
    await expect(consumeShopifyAccountLink({ token: 'token', shopDomain: 'demo.myshopify.com' }))
      .rejects.toThrow('already connected')
    expect(prisma.shopifyShop.update).not.toHaveBeenCalled()
  })

  it('links by explicit Project id and consumes the token once', async () => {
    prisma.shopifyAccountLink.findUnique.mockResolvedValue({
      id: 'link-1', projectId: 'project-1', consumedAt: null, expiresAt: new Date(Date.now() + 60_000),
    })
    prisma.shopifyShop.findFirst
      .mockResolvedValueOnce({ id: 'shop-1', projectId: null })
      .mockResolvedValueOnce(null)
    await expect(consumeShopifyAccountLink({ token: 'token', shopDomain: 'demo.myshopify.com' }))
      .resolves.toEqual({ projectId: 'project-1' })
    expect(prisma.shopifyShop.update).toHaveBeenCalledWith({
      where: { id: 'shop-1' },
      data: { projectId: 'project-1', linkedAt: expect.any(Date) },
    })
    expect(prisma.shopifyAccountLink.update).toHaveBeenCalledWith({
      where: { id: 'link-1' },
      data: { consumedAt: expect.any(Date), shopId: 'shop-1' },
    })
  })
})
