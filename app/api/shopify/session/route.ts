import { NextRequest, NextResponse } from 'next/server'
import { readShopifyIdToken, requireShopDomain, shopifyUnauthorized } from '@/lib/shopify/session'
import { exchangeIdToken, persistTokenSet, ShopifyIdTokenError } from '@/lib/shopify/tokens'
import { isShopifyFixtureMode } from '@/lib/shopify/fixture-session'

export async function POST(request: NextRequest) {
  const auth = requireShopDomain(request)
  if ('error' in auth) return auth.error
  if (isShopifyFixtureMode()) return NextResponse.json({ ok: true, fixture: true })
  const idToken = readShopifyIdToken(request)
  if (!idToken) return shopifyUnauthorized()
  try {
    const tokens = await exchangeIdToken(auth.shop, idToken)
    await persistTokenSet(auth.shop, tokens)
    return NextResponse.json({ ok: true })
  } catch (error) {
    if (error instanceof ShopifyIdTokenError) return shopifyUnauthorized(error.message)
    return NextResponse.json({ error: 'Token exchange failed' }, { status: 502 })
  }
}
