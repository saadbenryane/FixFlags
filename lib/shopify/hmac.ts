import { createHmac, timingSafeEqual } from 'node:crypto'
import { shopifyApiSecret } from './config'

export function verifyShopifyOAuthHmac(query: Record<string, string>): boolean {
  const secret = shopifyApiSecret()
  const hmac = query.hmac
  if (!secret || !hmac) return false
  const message = Object.keys(query)
    .filter((key) => key !== 'hmac' && key !== 'signature')
    .sort()
    .map((key) => `${key}=${query[key]}`)
    .join('&')
  const digest = createHmac('sha256', secret).update(message).digest('hex')
  const left = Buffer.from(digest, 'utf8')
  const right = Buffer.from(hmac, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}

export function verifyShopifyWebhookHmac(rawBody: string, header: string | null): boolean {
  const secret = shopifyApiSecret()
  if (!secret || !header) return false
  const digest = createHmac('sha256', secret).update(rawBody, 'utf8').digest('base64')
  const left = Buffer.from(digest, 'utf8')
  const right = Buffer.from(header, 'utf8')
  if (left.length !== right.length) return false
  return timingSafeEqual(left, right)
}
