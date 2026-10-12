import { createHmac } from 'node:crypto'
import { accountInfrastructureReady } from './contracts'

/** Compared in Redis only. Public health responses expose a boolean verdict. */
export function accountConfigurationFingerprint(env: Record<string, string | undefined> = process.env): string | null {
  if (!accountInfrastructureReady(env)) return null
  return createHmac('sha256', env.TOKEN_ENCRYPTION_KEY!).update(JSON.stringify([
    env.ACCOUNT_TEST_EMAIL, env.RESEND_API_KEY, env.RESEND_RECEIVING_WEBHOOK_SECRET,
    env.ACCOUNT_CHECKS_ENABLED, env.ACCOUNT_CHECKS_LIFECYCLE_VERIFIED,
  ])).digest('hex')
}
