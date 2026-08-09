import { createHmac, timingSafeEqual } from 'node:crypto'

const CLAIM_TTL_SECONDS = 60 * 60 * 24 * 30

type AnonymousClaim = {
  v: 1
  auditId: string
  exp: number
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET
  if (!value) throw new Error('BETTER_AUTH_SECRET is required to sign anonymous claims')
  return value
}

function signature(payload: string): string {
  return createHmac('sha256', secret()).update(`anonymous-claim:${payload}`).digest('base64url')
}

export function createAnonymousClaim(auditId: string, now = Date.now()): string {
  const claims: AnonymousClaim = {
    v: 1,
    auditId,
    exp: Math.floor(now / 1000) + CLAIM_TTL_SECONDS,
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${signature(payload)}`
}

export function verifyAnonymousClaim(value: string | undefined, now = Date.now()): AnonymousClaim | null {
  if (!value) return null
  const [payload, supplied, extra] = value.split('.')
  if (!payload || !supplied || extra) return null
  const expected = signature(payload)
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<AnonymousClaim>
    if (
      parsed.v !== 1 ||
      typeof parsed.auditId !== 'string' ||
      typeof parsed.exp !== 'number' ||
      parsed.exp <= Math.floor(now / 1000)
    ) return null
    return parsed as AnonymousClaim
  } catch {
    return null
  }
}
