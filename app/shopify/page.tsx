import { redirect } from 'next/navigation'
import { normalizeShopDomain } from '@/lib/shopify/config'
import { verifyShopifyOAuthHmac } from '@/lib/shopify/hmac'
import { isShopifyFixtureMode, signFixtureSession } from '@/lib/shopify/fixture-session'
import { countManualRechecksToday, loadInstalledShop } from '@/lib/shopify/load-shop'
import { buildShopifyWorkspace } from '@/lib/shopify/workspace'
import { ShopifyWorkspace } from './ShopifyWorkspace'

export const dynamic = 'force-dynamic'

export default async function ShopifyAppPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const query = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      key,
      Array.isArray(value) ? value[0] ?? '' : value ?? '',
    ])
  )
  if (query.hmac && !verifyShopifyOAuthHmac(query)) {
    redirect('/install?error=hmac')
  }

  const shopDomain = normalizeShopDomain(query.shop ?? '')
  if (!shopDomain) {
    if (isShopifyFixtureMode()) {
      redirect('/install?error=fixture_shop')
    }
    redirect('/install')
  }

  const shop = await loadInstalledShop(shopDomain)
  if (!shop) redirect('/install?error=not_installed')

  const rechecksUsed = await countManualRechecksToday(shop.paths.map((path) => path.id))
  const workspace = buildShopifyWorkspace({
    shop,
    paths: shop.paths,
    waitlist: shop.waitlist.map((entry) => entry.featureKey),
    rechecksRemaining: Math.max(0, 5 - rechecksUsed),
  })

  return (
    <ShopifyWorkspace
      workspace={workspace}
      fixtureToken={isShopifyFixtureMode() ? signFixtureSession(shopDomain) : null}
    />
  )
}
