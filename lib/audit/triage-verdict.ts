import { AUDIT_ERRORS } from '@/lib/marketing/copy'
import type { TriageFailureReason } from './pipeline/triage-failure'

/** Verdict copy when triage failed but deterministic evidence is shown. */
export function triageDegradedVerdict(
  reason: TriageFailureReason,
  signedIn: boolean
): string {
  if (reason === 'deadline_exhausted') {
    return AUDIT_ERRORS.triageDegradedTimeout
  }
  if (signedIn) {
    return AUDIT_ERRORS.triageDegradedSignedIn
  }
  return AUDIT_ERRORS.triageDegradedAnonymous
}
