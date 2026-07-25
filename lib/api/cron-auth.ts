import { timingSafeEqual } from 'crypto'

/**
 * Constant-time comparison of the incoming Authorization bearer token against
 * the CRON_SECRET environment variable. Returns `false` if either side is
 * missing or the tokens do not match.
 */
export function verifyCronSecret(authHeader: string | null): boolean {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || !authHeader) return false
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : authHeader
  if (token.length !== cronSecret.length) return false
  return timingSafeEqual(Buffer.from(token), Buffer.from(cronSecret))
}
