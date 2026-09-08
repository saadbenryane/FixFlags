import { NextRequest, NextResponse } from 'next/server'
import {
  isShopifyConfigured,
  normalizeShopDomain,
} from '@/lib/shopify/config'
import { verifyShopifyOAuthHmac } from '@/lib/shopify/hmac'
import { buildShopifyAuthorizeUrl, signShopifyInstallState } from '@/lib/shopify/oauth'
import { trackEvent } from '@/lib/analytics/events'

export async function GET(request: NextRequest) {
  if (!isShopifyConfigured()) {
    return NextResponse.json({ error: 'Shopify app is not configured' }, { status: 503 })
  }
  const shopParam = request.nextUrl.searchParams.get('shop') ?? ''
  const shop = normalizeShopDomain(shopParam)
  if (!shop) {
    return NextResponse.json({ error: 'Enter a shop like your-store.myshopify.com' }, { status: 400 })
  }
  const hmac = request.nextUrl.searchParams.get('hmac')
  if (hmac) {
    const query = Object.fromEntries(request.nextUrl.searchParams.entries())
    if (!verifyShopifyOAuthHmac(query)) {
      return NextResponse.json({ error: 'Invalid Shopify HMAC' }, { status: 401 })
    }
  }
  const state = signShopifyInstallState(shop)
  trackEvent('shopify_install_started', { shop })
  return NextResponse.redirect(buildShopifyAuthorizeUrl(shop, state))
}
