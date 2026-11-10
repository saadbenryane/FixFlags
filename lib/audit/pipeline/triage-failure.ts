import { AuditDeadlineError } from '../pipeline-errors'
import { JudgeContractError } from '../validate-judge-output'
import { classifyJudgeProviderFailure, isRetryableJudgeError } from '../judge'

export type TriageFailureReason =
  | 'no_provider_keys'
  | 'deadline_exhausted'
  | 'provider_exhausted'
  /** The provider refused the account: quota, credentials or permission. An operator must act. */
  | 'provider_rejected'
  | 'budget_unavailable'
  | 'contract_invalid'
  | 'unknown'

export interface TriageFailure {
  reason: TriageFailureReason
  message: string
  retryable: boolean
}

/** Map a triage step error to a structured failure for logging and finalize routing. */
export function parseTriageFailure(error: unknown): TriageFailure {
  const message = error instanceof Error ? error.message : String(error)
  const lower = message.toLowerCase()

  if (error instanceof AuditDeadlineError) {
    return { reason: 'deadline_exhausted', message, retryable: false }
  }

  if (
    lower.includes('api_key is not configured') ||
    lower.includes('no providers available')
  ) {
    return { reason: 'no_provider_keys', message, retryable: false }
  }

  if (error instanceof JudgeContractError || lower.includes('invalid triage output')) {
    return { reason: 'contract_invalid', message, retryable: false }
  }

  const providerFailure = classifyJudgeProviderFailure(error)
  if (providerFailure === 'budget_unavailable') {
    return { reason: 'budget_unavailable', message, retryable: false }
  }
  if (providerFailure === 'quota_exhausted' || providerFailure === 'authentication_rejected' || providerFailure === 'permission_denied') {
    return { reason: 'provider_rejected', message, retryable: false }
  }
  if (classifyJudgeProviderFailure(error)) {
    return { reason: 'provider_exhausted', message, retryable: isRetryableJudgeError(error) }
  }

  if (isRetryableJudgeError(error)) {
    return { reason: 'provider_exhausted', message, retryable: true }
  }

  if (
    lower.includes('triage failed') ||
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('timeout') ||
    lower.includes('abort')
  ) {
    return { reason: 'provider_exhausted', message, retryable: true }
  }

  return { reason: 'unknown', message, retryable: false }
}

export function triageFailureCode(reason: TriageFailureReason): string {
  switch (reason) {
    case 'no_provider_keys':
      return 'AI_PROVIDER_NOT_CONFIGURED'
    case 'deadline_exhausted':
      return 'AUDIT_TIMEOUT'
    case 'contract_invalid':
      return 'AI_CONTRACT_INVALID'
    case 'budget_unavailable':
      return 'AI_BUDGET_UNAVAILABLE'
    case 'provider_exhausted':
      return 'AI_PROVIDER_UNAVAILABLE'
    case 'provider_rejected':
      return 'AI_PROVIDER_REJECTED'
    case 'unknown':
    default:
      return 'AUDIT_PIPELINE_FAILED'
  }
}
