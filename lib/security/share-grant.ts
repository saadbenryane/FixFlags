import { createHmac, timingSafeEqual } from 'node:crypto'

export const SHARE_GRANT_COOKIE = 'ff_share_grant'
const GRANT_TTL_SECONDS = 60 * 60 * 24 * 30

export interface ShareGrantClaims {
  v: 1
  linkId: string
  auditId: string
  linkVersion: number
  exp: number
}

function secret(): string {
  const value = process.env.BETTER_AUTH_SECRET
  if (!value) throw new Error('BETTER_AUTH_SECRET is required to sign share grants')
  return value
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url')
}

export function createShareGrant(input: {
  linkId: string
  auditId: string
  linkVersion: number
  expiresAt?: Date | null
}): { value: string; expires: Date } {
  const maximum = Date.now() + GRANT_TTL_SECONDS * 1000
  const expiresMs = Math.min(maximum, input.expiresAt?.getTime() ?? maximum)
  const claims: ShareGrantClaims = {
    v: 1,
    linkId: input.linkId,
    auditId: input.auditId,
    linkVersion: input.linkVersion,
    exp: Math.floor(expiresMs / 1000),
  }
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return { value: `${payload}.${sign(payload)}`, expires: new Date(expiresMs) }
}

export function verifyShareGrant(value: string | undefined): ShareGrantClaims | null {
  if (!value) return null
  const [payload, provided, extra] = value.split('.')
  if (!payload || !provided || extra) return null
  const expected = sign(payload)
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Partial<ShareGrantClaims>
    if (
      claims.v !== 1 ||
      typeof claims.linkId !== 'string' ||
      typeof claims.auditId !== 'string' ||
      typeof claims.linkVersion !== 'number' ||
      typeof claims.exp !== 'number' ||
      claims.exp <= Math.floor(Date.now() / 1000)
    ) return null
    return claims as ShareGrantClaims
  } catch {
    return null
  }
}
