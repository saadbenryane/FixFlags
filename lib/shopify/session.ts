import { NextRequest, NextResponse } from 'next/server'
import { isShopifyFixtureMode, verifyFixtureSession } from './fixture-session'
import { ShopifyIdTokenError, verifyShopifyIdToken } from './tokens'

export const SHOPIFY_RETRY_HEADER = 'X-Shopify-Retry-Invalid-Session-Request'

export function shopifyUnauthorized(message = 'Invalid ID token'): NextResponse {
  const response = NextResponse.json({ error: message }, { status: 401 })
  response.headers.set(SHOPIFY_RETRY_HEADER, '1')
  return response
}

export function readShopifyIdToken(request: NextRequest): string | null {
  const header = request.headers.get('authorization')
  if (header?.startsWith('Bearer ')) return header.slice(7).trim() || null
  const queryToken = request.nextUrl.searchParams.get('id_token')
  return queryToken?.trim() || null
}

export function shopDomainFromRequest(request: NextRequest): string | null {
  const token = readShopifyIdToken(request)
  if (!token) return null
  if (isShopifyFixtureMode()) {
    return verifyFixtureSession(token)
  }
  try {
    return verifyShopifyIdToken(token).shop
  } catch {
    return null
  }
}

export function requireShopDomain(request: NextRequest): { shop: string } | { error: NextResponse } {
  const token = readShopifyIdToken(request)
  if (!token) return { error: shopifyUnauthorized() }
  if (isShopifyFixtureMode()) {
    const shop = verifyFixtureSession(token)
    if (!shop) return { error: shopifyUnauthorized() }
    return { shop }
  }
  try {
    return { shop: verifyShopifyIdToken(token).shop }
  } catch (error) {
    if (error instanceof ShopifyIdTokenError) return { error: shopifyUnauthorized(error.message) }
    return { error: shopifyUnauthorized() }
  }
}
