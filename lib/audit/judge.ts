/**
 * Shared retry predicate for the triage and prescription judges.
 *
 * The legacy single-pass judge (runJudgeWithRetry + provider callers) that used
 * to live here was removed when the pipeline moved to the two-phase design
 * (see judge-triage.ts and judge-prescription.ts). Only this shared error
 * classifier remains, imported by both phases.
 */
export type JudgeProviderFailure = 'authentication_rejected' | 'permission_denied' | 'quota_exhausted'
  | 'rate_limited' | 'provider_limit' | 'provider_unavailable' | 'budget_unavailable'

/** Preserve the last provider cause and whether any configured provider still
 * has a recoverable failure after the complete bounded attempt sequence. */
export class JudgeProviderError extends Error {
  constructor(cause: Error, readonly retryable: boolean) {
    super(cause.message, { cause })
    this.name = 'JudgeProviderError'
  }
}

const quotaCodes = new Set(['insufficient_quota', 'credit_balance_exhausted', 'billing_hard_limit_reached',
  'organization_spend_limit_exceeded', 'project_spend_limit_exceeded', 'organization_usage_limit_exceeded'])

/** SDK status and structured codes establish the failure. Message wording alone
 * cannot establish rejected credentials or a temporary versus funded limit. */
export function classifyJudgeProviderFailure(error: unknown): JudgeProviderFailure | null {
  for (let depth = 0; depth < 8 && error instanceof JudgeProviderError; depth++) error = error.cause
  if (!error || typeof error !== 'object') return null
  const status = 'status' in error ? error.status : undefined
  const code = 'code' in error ? error.code : undefined
  const type = 'type' in error ? error.type : undefined
  if (code === 'PROVIDER_BUDGET_UNAVAILABLE') return 'budget_unavailable'
  if (status === 401) return 'authentication_rejected'
  if (status === 403) return 'permission_denied'
  if (typeof code === 'string' && quotaCodes.has(code) || type === 'insufficient_quota') return 'quota_exhausted'
  if (status === 429) return code === 'slow_down' || code === 'rate_limit_exceeded' ? 'rate_limited' : 'provider_limit'
  return typeof status === 'number' && (status >= 500 && status < 600 || status === 408 || status === 409) ? 'provider_unavailable' : null
}

export function isRetryableJudgeError(err: unknown): boolean {
  if (err instanceof JudgeProviderError) return err.retryable
  if (!(err instanceof Error)) return false
  const failure = classifyJudgeProviderFailure(err)
  if (failure === 'authentication_rejected' || failure === 'permission_denied' || failure === 'quota_exhausted' || failure === 'budget_unavailable') return false
  if (failure) return true
  if (err.name === 'AbortError') return true
  const message = err.message.toLowerCase()
  return (
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('timeout') ||
    message.includes('aborted') ||
    message.includes('503') ||
    message.includes('529') ||
    message.includes('429')
  )
}
