import { z } from 'zod'
import { hasOpenBetaAccess } from '@/lib/billing/beta-policy'

export const accountIntentSchema = z.object({ revision: z.number().int().positive(),
  mode: z.enum(['routine', 'retest', 'cleanup']).default('routine'), siteUrl: z.string().url().optional() }).strict()
export type AccountIntent = z.infer<typeof accountIntentSchema>
export const accountObservationSchema = z.object({
  kind: z.enum(['signup', 'verification', 'signed_in', 'deletion']),
  state: z.enum(['verified', 'failed', 'unavailable', 'unknown']),
  detail: z.string().min(1).max(2000), pageUrl: z.string().url(),
  evidence: z.record(z.string(), z.json()).default({}),
}).strict()
export type AccountObservation = z.infer<typeof accountObservationSchema>
export const accountResultSchema = z.object({ observations: z.array(accountObservationSchema).min(1).max(100) }).strict()
export const accountPurposeSchema = z.enum(['retained', 'disposable'])
export const accountStateSchema = z.enum(['RESERVED', 'SUBMITTING', 'VERIFYING', 'ACTIVE', 'DELETING', 'DELETED'])
export const accountViewSchema = z.object({ enabled: z.boolean(), eligible: z.boolean(), ready: z.boolean(),
  canCleanup: z.boolean(), cleanupUnavailableReason: z.string().nullable(),
  reason: z.string().nullable(), accounts: z.array(z.object({ purpose: accountPurposeSchema, email: z.string(), state: accountStateSchema }).strict()).max(100),
  results: z.array(accountObservationSchema.extend({ checkedAt: z.string().datetime() })).max(100),
}).strict()
export type AccountChecksView = z.infer<typeof accountViewSchema>

export function accountChecksEntitled(user: { role: string; plan: string; subscriptionStatus: string } | null) {
  return Boolean(user && (user.role === 'admin' || hasOpenBetaAccess(user) ||
    ['BUILDER', 'TEAM'].includes(user.plan) && !['PAST_DUE', 'CANCELED', 'UNPAID'].includes(user.subscriptionStatus)))
}
export function accountInfrastructureReady(env: Record<string, string | undefined> = process.env) {
  if (env.ACCOUNT_CHECKS_VALIDATION_ORIGIN && !accountValidationOrigin(env)) return false
  return env.ACCOUNT_CHECKS_ENABLED === 'true' && (env.ACCOUNT_CHECKS_LIFECYCLE_VERIFIED === 'true' || accountValidationOrigin(env) !== null) &&
    /^[^\s+@]+@[^\s@]+\.[^\s@]+$/.test(env.ACCOUNT_TEST_EMAIL ?? '') &&
    /^[a-fA-F0-9]{64}$/.test(env.TOKEN_ENCRYPTION_KEY ?? '') &&
    Boolean(env.RESEND_API_KEY && env.RESEND_RECEIVING_WEBHOOK_SECRET)
}
/** Controlled lifecycle proof uses the normal engine while production remains
 * gated. The validation environment can act only on its explicit test origin. */
export function accountValidationOrigin(env: Record<string, string | undefined> = process.env): string | null {
  if (env.RAILWAY_ENVIRONMENT_NAME !== 'public-validation' || !env.ACCOUNT_CHECKS_VALIDATION_ORIGIN) return null
  try {
    const origin = new URL(env.ACCOUNT_CHECKS_VALIDATION_ORIGIN)
    if (origin.protocol !== 'https:' || origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash ||
      ['fixflags.com', 'www.fixflags.com'].includes(origin.hostname)) return null
    return origin.origin
  } catch { return null }
}
export function accountExecutionReady(siteUrl: string | undefined, env: Record<string, string | undefined> = process.env) {
  if (!accountInfrastructureReady(env)) return false
  const validation = accountValidationOrigin(env)
  if (!validation) return true
  try { return Boolean(siteUrl && new URL(siteUrl).origin === validation) } catch { return false }
}
/** Existing identities can be cleaned up after new checks are paused. Login
 * and deletion still require their stored credentials to be decryptable. */
export function accountCleanupReady(env: Record<string, string | undefined> = process.env) {
  return /^[a-fA-F0-9]{64}$/.test(env.TOKEN_ENCRYPTION_KEY ?? '')
}
export function safeEvidenceUrl(value: string) {
  const url = new URL(value); url.search = ''; url.hash = ''; url.username = ''; url.password = ''; return url.href
}
export function needsDisposableTest(input: { mode: AccountIntent['mode']; fingerprint: string; previousFingerprint?: string | null; state?: string | null }) {
  if (input.mode === 'cleanup') return false
  if (input.state && input.state !== 'DELETED') return false
  return input.mode === 'retest' || !input.previousFingerprint || input.fingerprint !== input.previousFingerprint
}

export function accountObservationContext(item: Pick<AccountObservation, 'kind' | 'pageUrl'>) {
  return `account:${item.kind}:v1:${safeEvidenceUrl(item.pageUrl)}`
}

export function collapseAccountObservations(items: AccountObservation[]) {
  const rank = { failed: 0, unknown: 1, unavailable: 2, verified: 3 }
  const byScope = new Map<string, AccountObservation>()
  for (const item of items) {
    const key = item.kind + ':' + item.pageUrl, prior = byScope.get(key)
    if (!prior || rank[item.state] < rank[prior.state]) byScope.set(key, item)
  }
  return [...byScope.values()]
}
