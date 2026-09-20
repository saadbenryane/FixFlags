import { redirect } from 'next/navigation'
import { normalizeShopDomain } from '@/lib/shopify/config'
import { verifyShopifyOAuthHmac } from '@/lib/shopify/hmac'
import { isShopifyFixtureMode, signFixtureSession } from '@/lib/shopify/fixture-session'
import { ShopifyAppLoader } from './ShopifyAppLoader'

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

  // The query string identifies the embedded frame only. Private shop data is
  // loaded client-side after Shopify ID-token verification.
  return <ShopifyAppLoader fixtureToken={isShopifyFixtureMode() ? signFixtureSession(shopDomain) : null} />
}
