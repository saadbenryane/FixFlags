import { createHmac, timingSafeEqual } from 'node:crypto'

const CLAIM_TTL_SECONDS = 60 * 60 * 24 * 30
/**
 * A signed-out visitor may hold several teaser scans at once (the anonymous
 * allowance repeats weekly), and every one of them is a report they must be able
 * to reopen. The list is bounded so the cookie cannot grow without limit; the
 * oldest entry is dropped first because recent reports are the ones revisited.
 */
const MAX_TRACKED_IDS = 8

type AnonymousClaim = {
  v: 1
  auditId: string
  exp: number
}

type AnonymousClaimSet = {
  v: 2
  auditIds: string[]
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

function encode(claims: AnonymousClaim | AnonymousClaimSet): string {
  const payload = Buffer.from(JSON.stringify(claims)).toString('base64url')
  return `${payload}.${signature(payload)}`
}

function decode(value: string | undefined, now: number): Record<string, unknown> | null {
  if (!value) return null
  const [payload, supplied, extra] = value.split('.')
  if (!payload || !supplied || extra) return null
  const expected = signature(payload)
  const a = Buffer.from(supplied)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>
    if (typeof parsed.exp !== 'number' || parsed.exp <= Math.floor(now / 1000)) return null
    return parsed
  } catch {
    return null
  }
}

export function createAnonymousClaim(auditId: string, now = Date.now()): string {
  return encode({ v: 1, auditId, exp: Math.floor(now / 1000) + CLAIM_TTL_SECONDS })
}

/**
 * Newest-first, deduplicated, capped. Order matters because the reader keeps the
 * leading entries when a long-lived cookie exceeds the cap.
 */
export function createAnonymousClaims(auditIds: string[], now = Date.now()): string {
  const ordered = [...new Set(auditIds.filter((id) => typeof id === 'string' && id.length > 0))]
  return encode({
    v: 2,
    auditIds: ordered.slice(0, MAX_TRACKED_IDS),
    exp: Math.floor(now / 1000) + CLAIM_TTL_SECONDS,
  })
}

export function verifyAnonymousClaim(value: string | undefined, now = Date.now()): AnonymousClaim | null {
  const parsed = decode(value, now)
  if (!parsed || parsed.v !== 1 || typeof parsed.auditId !== 'string') return null
  return parsed as unknown as AnonymousClaim
}

/**
 * Every audit id this browser owns, newest first. Accepts both claim versions so
 * a cookie written before the list existed keeps working and is simply widened.
 * An unsigned or tampered value yields nothing rather than a partial list.
 */
export function readAnonymousClaimIds(value: string | undefined, now = Date.now()): string[] {
  const parsed = decode(value, now)
  if (!parsed) return []
  if (parsed.v === 1 && typeof parsed.auditId === 'string' && parsed.auditId.length > 0) {
    return [parsed.auditId]
  }
  if (parsed.v !== 2 || !Array.isArray(parsed.auditIds)) return []
  return parsed.auditIds.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  )
}
