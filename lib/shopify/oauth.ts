import { createHmac } from 'node:crypto'
import { shopifyApiKey, shopifyApiSecret, shopifyCallbackUrl, SHOPIFY_SCOPES } from './config'

const STATE_TTL_MS = 15 * 60 * 1000

function stateSecret(): string {
  const secret = process.env.BETTER_AUTH_SECRET || shopifyApiSecret()
  if (!secret) throw new Error('BETTER_AUTH_SECRET or SHOPIFY_API_SECRET is required')
  return secret
}

export function signShopifyInstallState(shop: string, accountLinkToken?: string): string {
  const payload = `${shop}|${Date.now()}|${accountLinkToken ?? ''}`
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${sig}`).toString('base64url')
}

export function verifyShopifyInstallState(state: string, shop: string): boolean {
  return readShopifyInstallState(state, shop) !== null
}

export function readShopifyInstallState(
  state: string,
  shop: string,
): { accountLinkToken: string | null } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8')
    const parts = decoded.split('|')
    const [storedShop, ts] = parts
    const accountLinkToken = parts.length === 4 ? parts[2] : ''
    const sig = parts.length === 4 ? parts[3] : parts[2]
    if (!storedShop || !ts || !sig) return null
    if (storedShop !== shop) return null
    const age = Date.now() - Number(ts)
    if (!Number.isFinite(age) || age < 0 || age > STATE_TTL_MS) return null
    const payload = parts.length === 4
      ? `${storedShop}|${ts}|${accountLinkToken}`
      : `${storedShop}|${ts}`
    const expected = createHmac('sha256', stateSecret()).update(payload).digest('hex')
    return expected === sig ? { accountLinkToken: accountLinkToken || null } : null
  } catch {
    return null
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
