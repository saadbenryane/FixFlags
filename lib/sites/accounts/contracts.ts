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
export const accountViewSchema = z.object({ enabled: z.boolean(), eligible: z.boolean(), ready: z.boolean(),
  reason: z.string().nullable(), accounts: z.array(z.object({ purpose: z.string(), email: z.string(), state: z.string() }).strict()).max(2),
  results: z.array(accountObservationSchema.extend({ checkedAt: z.string().datetime() })).max(100),
}).strict()
export type AccountChecksView = z.infer<typeof accountViewSchema>

export function accountChecksEntitled(user: { role: string; plan: string; subscriptionStatus: string } | null) {
  return Boolean(user && (user.role === 'admin' || hasOpenBetaAccess(user) ||
    ['BUILDER', 'TEAM'].includes(user.plan) && !['PAST_DUE', 'CANCELED', 'UNPAID'].includes(user.subscriptionStatus)))
}
export function accountInfrastructureReady(env: Record<string, string | undefined> = process.env) {
  return env.ACCOUNT_CHECKS_ENABLED === 'true' && env.ACCOUNT_CHECKS_LIFECYCLE_VERIFIED === 'true' &&
    /^[^\s+@]+@[^\s@]+\.[^\s@]+$/.test(env.ACCOUNT_TEST_EMAIL ?? '') &&
    /^[a-fA-F0-9]{64}$/.test(env.TOKEN_ENCRYPTION_KEY ?? '') &&
    Boolean(env.RESEND_API_KEY && env.RESEND_RECEIVING_WEBHOOK_SECRET)
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
