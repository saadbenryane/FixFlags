import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import type { Prisma } from '@prisma/client'
import type { AdminActor } from '@/lib/auth/require-admin'
import { isAdminUser } from '@/lib/auth/permissions'
import { AdminActionError } from './errors'

export const ADMIN_INTENT_TTL_MS = 5 * 60_000

export function canonicalJson(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString())
  if (typeof value === 'bigint') return JSON.stringify(value.toString())
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(',')}}`
  }
  return JSON.stringify(value) ?? 'null'
}

export function revisionHash(value: unknown) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex')
}

function signingKey() {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret)
    throw new AdminActionError(
      'Operator authentication is not configured.',
      503,
      'ADMIN_UNAVAILABLE',
    )
  return secret
}

export function signAdminIntent(value: unknown): string {
  const payload = Buffer.from(canonicalJson(value)).toString('base64url')
  const signature = createHmac('sha256', signingKey())
    .update(`fixflags-admin-intent-v1:${payload}`)
    .digest('base64url')
  return `${payload}.${signature}`
}

export function readAdminIntent(token: string): unknown {
  if (token.length > 24_000)
    throw new AdminActionError('Invalid action confirmation.', 400, 'INVALID_INTENT')
  const parts = token.split('.')
  if (parts.length !== 2)
    throw new AdminActionError('Invalid action confirmation.', 400, 'INVALID_INTENT')
  const [payload, supplied] = parts
  const expected = createHmac('sha256', signingKey())
    .update(`fixflags-admin-intent-v1:${payload}`)
    .digest()
  const signature = Buffer.from(supplied, 'base64url')
  if (signature.length !== expected.length || !timingSafeEqual(signature, expected))
    throw new AdminActionError('Invalid action confirmation.', 400, 'INVALID_INTENT')
  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString())
  } catch {
    throw new AdminActionError('Invalid action confirmation.', 400, 'INVALID_INTENT')
  }
}

export function requireRecentAdminAuthentication(actor: AdminActor, now = new Date()) {
  const age = now.getTime() - actor.authenticatedAt.getTime()
  if (age < 0 || age >= ADMIN_INTENT_TTL_MS)
    throw new AdminActionError(
      'Sign in again before confirming this action.',
      403,
      'ADMIN_REAUTH_REQUIRED',
    )
}

export async function assertAdminActor(db: Prisma.TransactionClient, actor: AdminActor) {
  const user = await db.user.findUnique({
    where: { id: actor.id },
    select: { id: true, role: true, lifecycleStatus: true },
  })
  const session = await db.session.findFirst({
    where: { id: actor.sessionId, userId: actor.id, expiresAt: { gt: new Date() } },
    select: { id: true },
  })
  if (!user || user.lifecycleStatus !== 'ACTIVE' || !isAdminUser(user) || !session)
    throw new AdminActionError(
      'Administrator access is no longer available.',
      403,
      'ADMIN_ACCESS_REVOKED',
    )
}

export function redactAdminContent(value: string): string {
  return value
    .replace(/https?:\/\/\S+/gi, '[URL removed]')
    .replace(/[^\s@]+@[^\s@]+\.[^\s@]+/g, '[email removed]')
    .replace(
      /\b(?:sk_[a-zA-Z0-9_]+|ff_live_[a-zA-Z0-9_]+|Bearer\s+\S+)\b/gi,
      '[credential removed]',
    )
}

export function redactAdminText(value: string) {
  return redactAdminContent(value).slice(0, 1000)
}

export function safeActivityDetail(value: unknown): Prisma.JsonValue {
  if (typeof value === 'string') return redactAdminText(value)
  if (typeof value === 'number' || typeof value === 'boolean' || value === null) return value
  if (Array.isArray(value)) return value.map(safeActivityDetail)
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            !/(secret|token|password|credential|body|email|html|storage|sessionId)/i.test(key),
        )
        .map(([key, item]) => [key, safeActivityDetail(item)]),
    )
  return null
}
