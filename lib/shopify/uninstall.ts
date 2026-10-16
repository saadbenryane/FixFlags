import { trackEvent } from '@/lib/analytics/events'
import { prisma } from '@/lib/db'
import { deleteIntegrityPathArtifacts } from '@/lib/integrity/storage'
import { logger } from '@/lib/logger'

export async function uninstallShop(shopDomain: string): Promise<void> {
  const shop = await prisma.shopifyShop.findFirst({
    where: { shopDomain },
    include: { paths: { select: { id: true } } },
  })
  if (!shop) return
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      uninstalledAt: new Date(),
      authorizationVersion: { increment: 1 },
      encryptedAccessToken: '',
      encryptedRefreshToken: null,
      tokenExpiresAt: null,
      refreshExpiresAt: null,
    },
  })
  await prisma.revenuePath.updateMany({
    where: { shopId: shop.id },
    data: {
      watchNextRunAt: null,
      pulseNextRunAt: null,
      watchLeaseUntil: null,
      pulseLeaseUntil: null,
    },
  })
  await deleteIntegrityPathArtifacts(shop.paths.map(path => path.id))
  trackEvent('shopify_uninstalled', { shop: shopDomain })
  logger.info('Shopify shop uninstalled', { shopDomain })
}

export async function redactShop(shopDomain: string): Promise<void> {
  await uninstallShop(shopDomain)
  await prisma.shopifyShop.deleteMany({ where: { shopDomain } })
}
