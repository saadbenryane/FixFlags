import { NextRequest, NextResponse } from 'next/server'
import { countManualRechecksToday, loadInstalledShop } from '@/lib/shopify/load-shop'
import { requireShopDomain } from '@/lib/shopify/session'
import { buildShopifyWorkspace } from '@/lib/shopify/workspace'

export async function GET(request: NextRequest) {
  const auth = requireShopDomain(request)
  if ('error' in auth) return auth.error
  const shop = await loadInstalledShop(auth.shop)
  if (!shop) return NextResponse.json({ error: 'Store not found' }, { status: 404 })
  const rechecksUsed = await countManualRechecksToday(shop.paths.map((path) => path.id))
  return NextResponse.json(
    buildShopifyWorkspace({
      shop,
      paths: shop.paths,
      waitlist: shop.waitlist.map((entry) => entry.featureKey),
      rechecksRemaining: Math.max(0, 5 - rechecksUsed),
    })
  )
}
