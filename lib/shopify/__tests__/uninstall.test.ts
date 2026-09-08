import { beforeEach, describe, expect, it, vi } from 'vitest'

const findFirst = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
const updateMany = vi.hoisted(() => vi.fn())
const deleteMany = vi.hoisted(() => vi.fn())
const findMany = vi.hoisted(() => vi.fn())
const deleteIntegrityPrefix = vi.hoisted(() => vi.fn())
const trackEvent = vi.hoisted(() => vi.fn())

vi.mock('@/lib/db', () => ({
  prisma: {
    shopifyShop: { findFirst, update, deleteMany },
    revenuePath: { updateMany, findMany },
  },
}))
vi.mock('@/lib/integrity/storage', () => ({ deleteIntegrityPrefix }))
vi.mock('@/lib/analytics/events', () => ({ trackEvent }))
vi.mock('@/lib/integrity/enqueue', () => ({ enqueueIntegrityProbe: vi.fn() }))

import { redactShop, uninstallShop } from '@/lib/shopify/uninstall'
import { processDueIntegrityWatches } from '@/lib/integrity/watch'

describe('uninstall and redact', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    findFirst.mockResolvedValue({
      id: 'shop-1',
      shopDomain: 'demo.myshopify.com',
      paths: [{ runs: [{ id: 'r1', videoUrl: 'https://x/integrity-assets/run-1/walk.webm', gifUrl: null }] }],
    })
    update.mockResolvedValue({})
    updateMany.mockResolvedValue({ count: 1 })
    deleteMany.mockResolvedValue({ count: 1 })
    deleteIntegrityPrefix.mockResolvedValue(undefined)
  })

  it('stops later watches and clears stored tokens', async () => {
    await uninstallShop('demo.myshopify.com')
    expect(updateMany).toHaveBeenCalledWith({
      where: { shopId: 'shop-1' },
      data: {
        watchNextRunAt: null,
        pulseNextRunAt: null,
        watchLeaseUntil: null,
        pulseLeaseUntil: null,
      },
    })
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'shop-1' },
        data: expect.objectContaining({
          encryptedAccessToken: '',
          uninstalledAt: expect.any(Date),
        }),
      })
    )
    expect(deleteIntegrityPrefix).toHaveBeenCalledWith('run-1')
    expect(trackEvent).toHaveBeenCalledWith('shopify_uninstalled', { shop: 'demo.myshopify.com' })
  })

  it('does not enqueue watches for uninstalled shops', async () => {
    findMany.mockResolvedValue([])
    await processDueIntegrityWatches()
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          shop: { uninstalledAt: null },
        }),
      })
    )
  })

  it('deletes the shop record on redact', async () => {
    await redactShop('demo.myshopify.com')
    expect(deleteMany).toHaveBeenCalledWith({ where: { shopDomain: 'demo.myshopify.com' } })
  })
})
