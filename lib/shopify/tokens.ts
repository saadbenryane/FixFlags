import { createHmac, timingSafeEqual } from 'node:crypto'
import { prisma } from '@/lib/db'
import { decryptSecret, encryptSecret } from '@/lib/security/crypto'
import { shopifyApiKey, shopifyApiSecret } from './config'

const REFRESH_SKEW_MS = 60 * 1000

export class ShopifyReauthorizeError extends Error {
  constructor(message = 'Shopify reinstall required') {
    super(message)
    this.name = 'ShopifyReauthorizeError'
  }
}

export interface ShopifyTokenSet {
  accessToken: string
  refreshToken: string | null
  scope: string
  expiresAt: Date | null
  refreshExpiresAt: Date | null
}

function expiresAtFrom(seconds: unknown): Date | null {
  const value = Number(seconds)
  if (!Number.isFinite(value) || value <= 0) return null
  return new Date(Date.now() + value * 1000)
}

async function shopifyTokenRequest(
  shop: string,
  body: URLSearchParams
): Promise<{ status: number; payload: Record<string, unknown> }> {
  const response = await fetch(`https://${shop}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
    signal: AbortSignal.timeout(30_000),
  })
  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>
  return { status: response.status, payload }
}

function parseTokenPayload(payload: Record<string, unknown>): ShopifyTokenSet {
  const accessToken = payload.access_token
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('Shopify token response had no access_token')
  }
  return {
    accessToken,
    refreshToken: typeof payload.refresh_token === 'string' ? payload.refresh_token : null,
    scope: typeof payload.scope === 'string' ? payload.scope : 'read_products',
    expiresAt: expiresAtFrom(payload.expires_in),
    refreshExpiresAt: expiresAtFrom(payload.refresh_token_expires_in),
  }
}

export async function exchangeAuthorizationCode(shop: string, code: string): Promise<ShopifyTokenSet> {
  const { status, payload } = await shopifyTokenRequest(
    shop,
    new URLSearchParams({
      client_id: shopifyApiKey(),
      client_secret: shopifyApiSecret(),
      code,
      expiring: '1',
    })
  )
  if (status !== 200) {
    throw new Error(`Shopify code exchange failed (${status})`)
  }
  return parseTokenPayload(payload)
}

export async function exchangeIdToken(shop: string, idToken: string): Promise<ShopifyTokenSet> {
  const { status, payload } = await shopifyTokenRequest(
    shop,
    new URLSearchParams({
      client_id: shopifyApiKey(),
      client_secret: shopifyApiSecret(),
      grant_type: 'urn:ietf:params:oauth:grant-type:token-exchange',
      subject_token: idToken,
      subject_token_type: 'urn:ietf:params:oauth:token-type:id_token',
      requested_token_type: 'urn:shopify:params:oauth:token-type:offline-access-token',
      expiring: '1',
    })
  )
  if (status === 400) {
    throw new ShopifyIdTokenError('Shopify rejected the ID token')
  }
  if (status !== 200) {
    throw new Error(`Shopify token exchange failed (${status})`)
  }
  return parseTokenPayload(payload)
}

export class ShopifyIdTokenError extends Error {
  constructor(message = 'Invalid Shopify ID token') {
    super(message)
    this.name = 'ShopifyIdTokenError'
  }
}

export function verifyShopifyIdToken(idToken: string): { shop: string; sub: string } {
  const secret = shopifyApiSecret()
  if (!secret) throw new ShopifyIdTokenError('Shopify secret is not configured')
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new ShopifyIdTokenError('Malformed ID token')
  const [header, payload, signature] = parts
  const expected = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url')
  const left = Buffer.from(expected)
  const right = Buffer.from(signature)
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw new ShopifyIdTokenError('ID token signature mismatch')
  }
  const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
    exp?: number
    nbf?: number
    aud?: string
    iss?: string
    dest?: string
    sub?: string
  }
  const now = Math.floor(Date.now() / 1000)
  if (typeof claims.exp === 'number' && claims.exp <= now) throw new ShopifyIdTokenError('ID token expired')
  if (typeof claims.nbf === 'number' && claims.nbf > now) throw new ShopifyIdTokenError('ID token not yet valid')
  if (claims.aud !== shopifyApiKey()) throw new ShopifyIdTokenError('ID token audience mismatch')
  if (!claims.iss || !claims.dest) throw new ShopifyIdTokenError('ID token missing dest')
  const issuerHost = new URL(claims.iss).hostname
  const destHost = new URL(claims.dest).hostname
  if (issuerHost !== destHost) throw new ShopifyIdTokenError('ID token issuer/dest mismatch')
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(destHost)) {
    throw new ShopifyIdTokenError('ID token dest is not a shop domain')
  }
  return { shop: destHost, sub: claims.sub ?? '' }
}

export async function persistTokenSet(
  shopDomain: string,
  tokens: ShopifyTokenSet,
  extras: { name?: string | null; email?: string | null; primaryUrl?: string | null } = {}
) {
  return prisma.shopifyShop.upsert({
    where: { shopDomain },
    create: {
      shopDomain,
      name: extras.name,
      email: extras.email,
      primaryUrl: extras.primaryUrl,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      tokenExpiresAt: tokens.expiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      scopes: tokens.scope,
      uninstalledAt: null,
    },
    update: {
      name: extras.name,
      email: extras.email,
      primaryUrl: extras.primaryUrl,
      encryptedAccessToken: encryptSecret(tokens.accessToken),
      encryptedRefreshToken: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : undefined,
      tokenExpiresAt: tokens.expiresAt,
      refreshExpiresAt: tokens.refreshExpiresAt,
      scopes: tokens.scope,
      uninstalledAt: null,
    },
  })
}

export async function getValidOfflineToken(shopDomain: string): Promise<string> {
  const shop = await prisma.shopifyShop.findFirst({
    where: { shopDomain, uninstalledAt: null },
  })
  if (!shop?.encryptedAccessToken) throw new ShopifyReauthorizeError()
  const stillValid =
    !shop.tokenExpiresAt || shop.tokenExpiresAt.getTime() - REFRESH_SKEW_MS > Date.now()
  if (stillValid) return decryptSecret(shop.encryptedAccessToken)
  if (!shop.encryptedRefreshToken) throw new ShopifyReauthorizeError()
  const { status, payload } = await shopifyTokenRequest(
    shopDomain,
    new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: shopifyApiKey(),
      client_secret: shopifyApiSecret(),
      refresh_token: decryptSecret(shop.encryptedRefreshToken),
    })
  )
  if (status === 401) throw new ShopifyReauthorizeError()
  if (status === 429 || status >= 500) {
    throw new Error(`Shopify token refresh transient failure (${status})`)
  }
  if (status !== 200) throw new Error(`Shopify token refresh rejected (${status})`)
  const next = parseTokenPayload(payload)
  await prisma.shopifyShop.update({
    where: { id: shop.id },
    data: {
      encryptedAccessToken: encryptSecret(next.accessToken),
      encryptedRefreshToken: next.refreshToken ? encryptSecret(next.refreshToken) : shop.encryptedRefreshToken,
      tokenExpiresAt: next.expiresAt,
      refreshExpiresAt: next.refreshExpiresAt ?? shop.refreshExpiresAt,
    },
  })
  return next.accessToken
}
