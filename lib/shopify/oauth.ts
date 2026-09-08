import { createHmac } from 'node:crypto'
import { shopifyApiKey, shopifyApiSecret, shopifyCallbackUrl, SHOPIFY_SCOPES } from './config'

const STATE_TTL_MS = 15 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || shopifyApiSecret()
  if (!secret) throw new Error('BETTER_AUTH_SECRET or SHOPIFY_API_SECRET is required')
  return secret
}

export function signShopifyInstallState(shop: string): string {
  const payload = `${shop}|${Date.now()}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

export function verifyShopifyInstallState(state: string, shop: string): boolean {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const [storedShop, ts, sig] = decoded.split('|')
    if (!storedShop || !ts || !sig) return false
    if (storedShop !== shop) return false
    const age = Date.now() - Number(ts)
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return false
    const expected = createHmac('sha256', stateSecret()).update(`${storedShop}|${ts}`).digest('hex')
    return expected === sig
  } catch {
    return false
  }
}

export function buildShopifyAuthorizeUrl(shop: string, state: string): string {
  const params = new URLSearchParams({
    client_id: shopifyApiKey(),
    scope: SHOPIFY_SCOPES,
    redirect_uri: shopifyCallbackUrl(),
    state,
  })
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`
}

export { exchangeAuthorizationCode as exchangeShopifyCode } from './tokens'
