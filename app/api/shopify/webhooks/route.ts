import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { enqueueIntegrityProbe } from '@/lib/integrity/enqueue'
import { verifyShopifyWebhookHmac } from '@/lib/shopify/hmac'
import { normalizeShopDomain } from '@/lib/shopify/config'
import { redactShop, uninstallShop } from '@/lib/shopify/uninstall'
import { reportOperationalError } from '@/lib/observability/report-error'

export async function POST(request: NextRequest) {
  const rawBody = await request.text()
  const hmac = request.headers.get('x-shopify-hmac-sha256')
  if (!verifyShopifyWebhookHmac(rawBody, hmac)) {
    return NextResponse.json({ error: 'Invalid HMAC' }, { status: 401 })
  }
  const topic = request.headers.get('x-shopify-topic') ?? ''
  const shopHeader = request.headers.get('x-shopify-shop-domain') ?? ''
  const shop = normalizeShopDomain(shopHeader)
  try {
    if (topic === 'app/uninstalled' && shop) {
      await uninstallShop(shop)
    } else if (topic === 'shop/redact' && shop) {
      await redactShop(shop)
    } else if (
      (topic === 'customers/data_request' || topic === 'customers/redact') &&
      shop
    ) {
      const record = await prisma.shopifyShop.findFirst({ where: { shopDomain: shop } })
      await prisma.shopifyGdprRequest.create({
        data: {
          shopId: record?.id,
          topic,
          payload: JSON.parse(rawBody) as object,
        },
      })
    } else if (topic === 'products/update' && shop) {
      const payload = JSON.parse(rawBody) as { admin_graphql_api_id?: string }
      const gid = payload.admin_graphql_api_id
      if (gid) {
        const debounceBefore = new Date(Date.now() - 15 * 60 * 1000)
        const paths = await prisma.revenuePath.findMany({
          where: { productGid: gid, shop: { shopDomain: shop, uninstalledAt: null } },
          select: { id: true, lastVerifiedAt: true },
        })
        for (const path of paths) {
          if (path.lastVerifiedAt && path.lastVerifiedAt > debounceBefore) continue
          await enqueueIntegrityProbe(path.id, 'webhook')
        }
      }
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    reportOperationalError('shopify-webhook', error, { topic, shop })
    logger.error('Shopify webhook failed', {
      topic,
      error: error instanceof Error ? error.message : String(error),
    })
    return NextResponse.json({ ok: true })
  }
}
