import { NextRequest, NextResponse } from 'next/server'
import { getAppUrl } from '@/lib/get-app-url'
import { logger } from '@/lib/logger'
import { isShopifyConfigured, normalizeShopDomain, shopifyApiKey } from '@/lib/shopify/config'
import { verifyShopifyOAuthHmac } from '@/lib/shopify/hmac'
import { persistInstalledShop } from '@/lib/shopify/install-shop'
import { exchangeShopifyCode, verifyShopifyInstallState } from '@/lib/shopify/oauth'

export async function GET(request: NextRequest) {
  if (!isShopifyConfigured()) {
    return NextResponse.redirect(new URL('/install?error=not_configured', getAppUrl()))
  }
  const query = Object.fromEntries(request.nextUrl.searchParams.entries())
  const shop = normalizeShopDomain(query.shop ?? '')
  const code = query.code
  const state = query.state
  if (!shop || !code || !state) {
    return NextResponse.redirect(new URL('/install?error=missing', getAppUrl()))
  }
  if (query.hmac && !verifyShopifyOAuthHmac(query)) {
    return NextResponse.redirect(new URL('/install?error=hmac', getAppUrl()))
  }
  if (!verifyShopifyInstallState(state, shop)) {
    return NextResponse.redirect(new URL('/install?error=state', getAppUrl()))
  }
  try {
    const tokens = await exchangeShopifyCode(shop, code)
    await persistInstalledShop({ shopDomain: shop, tokens })
    const storeHandle = shop.replace(/\.myshopify\.com$/, '')
    const embeddedAdmin = shopifyApiKey()
      ? `https://admin.shopify.com/store/${storeHandle}/apps/${shopifyApiKey()}`
      : `${getAppUrl()}/shopify?shop=${encodeURIComponent(shop)}`
    return NextResponse.redirect(embeddedAdmin)
  } catch (error) {
    logger.error('Shopify install callback failed', error instanceof Error ? error : new Error(String(error)))
    return NextResponse.redirect(new URL('/install?error=token', getAppUrl()))
  }
}
