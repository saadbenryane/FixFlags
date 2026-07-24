import { AUDIT_ERRORS } from '@/lib/marketing/copy'

/** User-facing body for the triage-degraded callout. Never uses partialReport fallback. */
export function triageUnavailableBody(
  failureCode: string | null | undefined,
  isLoggedIn: boolean
): string {
  if (failureCode === 'AI_PROVIDER_NOT_CONFIGURED') {
    return AUDIT_ERRORS.triageProviderNotConfigured
  }
  if (failureCode === 'AUDIT_TIMEOUT') {
    return AUDIT_ERRORS.triageDegradedTimeout
  }
  if (isLoggedIn) {
    return AUDIT_ERRORS.triageDegradedSignedIn
  }
  return AUDIT_ERRORS.triageDegradedAnonymous
}
