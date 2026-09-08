import { trackEvent } from '@/lib/analytics/events'
import { prisma } from '@/lib/db'
import { deleteIntegrityPrefix } from '@/lib/integrity/storage'
import { logger } from '@/lib/logger'

export async function uninstallShop(shopDomain: string): Promise<void> {
  const shop = await prisma.shopifyShop.findFirst({
    where: { shopDomain },
    include: { paths: { include: { runs: { select: { id: true, videoUrl: true, gifUrl: true } } } } },
  })
  if (!shop) return
  for (const path of shop.paths) {
    for (const run of path.runs) {
      const runId = run.videoUrl?.match(/integrity-assets\/([^/]+)/)?.[1]
      if (runId) await deleteIntegrityPrefix(runId)
    }
  }
  await prisma.revenuePath.updateMany({
    where: { shopId: shop.id },
    data: {
      watchNextRunAt: null,
      pulseNextRunAt: null,
      watchLeaseUntil: null,
      pulseLeaseUntil: null,
    },
  })
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      uninstalledAt: new Date(),
      encryptedAccessToken: '',
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      refreshExpiresAt: null,
    },
  })
  trackEvent('shopify_uninstalled', { shop: shopDomain })
  logger.info('Shopify shop uninstalled', { shopDomain })
}

export async function redactShop(shopDomain: string): Promise<void> {
  await uninstallShop(shopDomain)
  await prisma.shopifyShop.deleteMany({ where: { shopDomain } })
}
