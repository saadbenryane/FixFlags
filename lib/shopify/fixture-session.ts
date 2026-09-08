import { createHmac, timingSafeEqual } from 'node:crypto'

const FIXTURE_PREFIX = 'ff-fixture.'

export function isShopifyFixtureMode(): boolean {
  return (
    process.env.NODE_ENV !== 'production' &&
    process.env.FIXFLAGS_SHOPIFY_FIXTURE === '1'
  )
}

function fixtureSecret(): string {
  return process.env.BETTER_AUTH_SECRET || process.env.SHOPIFY_API_SECRET || 'fixflags-fixture-secret'
}

export function signFixtureSession(shop: string): string {
  const sig = createHmac('sha256', fixtureSecret()).update(shop).digest('hex')
  return `${FIXTURE_PREFIX}${shop}.${sig}`
}

export function verifyFixtureSession(token: string): string | null {
  if (!isShopifyFixtureMode()) return null
  if (!token.startsWith(FIXTURE_PREFIX)) return null
  const raw = token.slice(FIXTURE_PREFIX.length)
  const dot = raw.lastIndexOf('.')
  if (dot < 1) return null
  const shop = raw.slice(0, dot)
  const sig = raw.slice(dot + 1)
  const expected = createHmac('sha256', fixtureSecret()).update(shop).digest('hex')
  const left = Buffer.from(expected)
  const right = Buffer.from(sig)
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null
  return shop
}
