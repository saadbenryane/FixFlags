import { trackEvent } from '@/lib/analytics/events'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { enqueueIntegrityProbe } from '@/lib/integrity/enqueue'
import { shopifyAdminGraphql, SHOP_AND_PRODUCTS_QUERY, type ShopifyShopQuery } from './admin'
import { pickStorefrontPaths } from './discover'
import { persistTokenSet, type ShopifyTokenSet } from './tokens'
import { subscribeShopifyWebhooks } from './webhooks'

const WATCH_MS = 6 * 60 * 60 * 1000
const PULSE_MS = 15 * 60 * 1000
const MAX_AUTO_PATHS = 2

export async function persistInstalledShop(input: {
  shopDomain: string
  tokens: ShopifyTokenSet
}): Promise<{ shopId: string; pathId: string | null }> {
  const data = await shopifyAdminGraphql<ShopifyShopQuery>(
    input.shopDomain,
    input.tokens.accessToken,
    SHOP_AND_PRODUCTS_QUERY
  ).catch((error) => {
    logger.warn('Shopify shop query failed after install', {
      shop: input.shopDomain,
      error: error instanceof Error ? error.message : String(error),
    })
    return null
  })

  const shop = await persistTokenSet(input.shopDomain, input.tokens, {
    name: data?.shop.name,
    email: data?.shop.email,
    primaryUrl: data?.shop.primaryDomain?.url,
  })

  await subscribeShopifyWebhooks(input.shopDomain, input.tokens.accessToken)

  const discovered = data ? pickStorefrontPaths(data.products.nodes, MAX_AUTO_PATHS) : []
  const existingCount = await prisma.revenuePath.count({ where: { shopId: shop.id } })
  let firstPathId: string | null = null
  let created = existingCount
  for (const item of discovered) {
    const existing = await prisma.revenuePath.findFirst({
      where: { shopId: shop.id, storefrontUrl: item.storefrontUrl },
    })
    if (!existing && created >= MAX_AUTO_PATHS) continue
    const path =
      existing ??
      (await prisma.revenuePath.create({
        data: {
          shopId: shop.id,
          productGid: item.productGid,
          storefrontUrl: item.storefrontUrl,
          label: item.label,
          source: 'auto',
          watchNextRunAt: new Date(Date.now() + WATCH_MS),
          pulseNextRunAt: new Date(Date.now() + PULSE_MS),
        },
      }))
    if (!existing) created += 1
    firstPathId ??= path.id
    await enqueueIntegrityProbe(path.id, 'install').catch((error) => {
      logger.warn('Install probe enqueue failed', {
        pathId: path.id,
        error: error instanceof Error ? error.message : String(error),
      })
    })
  }

  trackEvent('shopify_install_completed', { shop: input.shopDomain })
  return { shopId: shop.id, pathId: firstPathId }
}
