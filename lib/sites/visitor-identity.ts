/**
 * Anonymous visitor identity.
 *
 * An anonymous Site board is a private tenant, so it needs a stable owner key.
 * That key must be private (so a visitor's board is not theirs to publish),
 * stable across requests (so a refresh still resolves the same board), and
 * free of personal data.
 *
 * A raw IP address is the wrong key for all three reasons: it is personal data
 * retained for the life of the board, it is shared by everyone behind one NAT or
 * proxy, and when the proxy headers are absent every visitor collapses onto a
 * single literal 'unknown' and shares one board.
 *
 * So identity and abuse control are deliberately separate:
 *   - this module owns *identity* (a random opaque token in an httpOnly cookie)
 *   - `requestClientId` owns *abuse control* (the IP, which is the correct signal
 *     for rate limiting and is never persisted as a tenancy key)
 *
 * The two are joined only where both are genuinely needed: the one-free-scan
 * gate is scoped to the visitor, and the IP soft ceiling still bounds cookie
 * clearing.
 */

import { cookies } from 'next/headers'
import { randomBytes } from 'node:crypto'
import { sharedCookieDomain, requestHostname } from '@/lib/http/site-host'

/** Long enough that a returning visitor keeps their board across a month. */
export const ANON_VISITOR_COOKIE = 'ff_anon_visitor'
export const ANON_VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 180

/**
 * Session keys are stored in `provisional_sites.session_key`, so the shape has
 * to stay self-describing and bounded: a fixed prefix makes stored keys
 * greppable, and a version marker lets a future format change be detected
 * instead of silently misread.
 */
const VISITOR_KEY_PREFIX = 'anon-v1'

/** Unambiguous alphabet: no base64 padding or URL characters to escape. */
const TOKEN_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const TOKEN_BYTES = 16

export function generateVisitorId(): string {
  const bytes = randomBytes(TOKEN_BYTES)
  let token = ''
  for (const byte of bytes) {
    token += TOKEN_ALPHABET[byte % TOKEN_ALPHABET.length]
  }
  return `${VISITOR_KEY_PREFIX}:${token}`
}

function isWellFormedVisitorId(value: string | undefined | null): value is string {
  if (!value) return false
  if (!value.startsWith(`${VISITOR_KEY_PREFIX}:`)) return false
  const token = value.slice(VISITOR_KEY_PREFIX.length + 1)
  if (token.length !== TOKEN_BYTES) return false
  for (const char of token) {
    if (!TOKEN_ALPHABET.includes(char)) return false
  }
  return true
}

type VisitorCookieOptions = { setCookie: boolean }

async function hostForCookie(): Promise<string | null> {
  try {
    const headerStore = await import('next/headers').then((mod) => mod.headers())
    const raw = headerStore.get('x-forwarded-host') ?? headerStore.get('host')
    return raw?.split(',')[0]?.trim().split(':')[0] ?? null
  } catch {
    return null
  }
}

/**
 * Read the existing visitor identity, minting and persisting one when absent.
 *
 * Returns a stable key on every call, so callers can use it as a tenancy key
 * without branching on whether a cookie already existed.
 */
export async function resolveVisitorKey(
  options: VisitorCookieOptions = { setCookie: true }
): Promise<string> {
  const store = await readCookieStore()
  const existing = store?.get(ANON_VISITOR_COOKIE)?.value
  if (isWellFormedVisitorId(existing)) return existing

  const minted = generateVisitorId()
  // Outside a request (worker, CLI, script) there is no cookie jar to write to.
  // An unpersisted random key is the correct degradation: the caller gets its
  // own board and its own scan, and simply loses reuse. It must never fall
  // back to a shared literal, or unrelated callers would share one board.
  if (store && options.setCookie) {
    const domain = sharedCookieDomain(undefined, await hostForCookie())
    const secure = process.env.NODE_ENV === 'production'
    // Drop a host-only leftover first so it cannot shadow the shared-domain
    // cookie, which would give www and apex two different identities.
    if (domain) {
      store.set(ANON_VISITOR_COOKIE, '', {
        httpOnly: true,
        maxAge: 0,
        sameSite: 'lax',
        path: '/',
        secure,
      })
    }
    store.set(ANON_VISITOR_COOKIE, minted, {
      httpOnly: true,
      maxAge: ANON_VISITOR_MAX_AGE_SECONDS,
      sameSite: 'lax',
      path: '/',
      secure,
      ...(domain ? { domain } : {}),
    })
  }
  return minted
}

/**
 * Read-only variant for request paths that must not mutate cookies (renders,
 * API access checks). Mints a stable key for this request when no cookie
 * exists so that resolution never collapses onto a shared literal.
 */
export async function peekVisitorKey(): Promise<string> {
  const existing = (await readCookieStore())?.get(ANON_VISITOR_COOKIE)?.value
  if (isWellFormedVisitorId(existing)) return existing
  return generateVisitorId()
}

/** `cookies()` throws outside a request scope; treat that as "no jar". */
async function readCookieStore(): Promise<Awaited<ReturnType<typeof cookies>> | null> {
  try {
    return await cookies()
  } catch {
    return null
  }
}

export { requestHostname as visitorCookieHost }
