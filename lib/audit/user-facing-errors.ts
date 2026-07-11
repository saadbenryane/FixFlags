import { AUDIT_ERRORS } from '@/lib/marketing/copy'

const FAILURE_CODE_MESSAGES: Record<string, string> = {
  AUDIT_TIMEOUT: AUDIT_ERRORS.timeout,
  DESKTOP_CAPTURE_FAILED: AUDIT_ERRORS.captureFailed,
  AI_CONTRACT_INVALID: AUDIT_ERRORS.aiReviewFailed,
  AI_REVIEW_FAILED: AUDIT_ERRORS.partialAiReview,
  AI_PROVIDER_NOT_CONFIGURED: AUDIT_ERRORS.scannerUnavailable,
  AUDIT_PIPELINE_FAILED: AUDIT_ERRORS.generic,
  AUDIT_JOB_FAILED: AUDIT_ERRORS.generic,
  QUEUE_ENQUEUE_FAILED: AUDIT_ERRORS.generic,
  // Our infrastructure, not the target site; never blame the user's site.
  BROWSER_LAUNCH_FAILED: AUDIT_ERRORS.scannerUnavailable,
  STORAGE_NOT_CONFIGURED: AUDIT_ERRORS.scannerUnavailable,
  STORAGE_UPLOAD_FAILED: AUDIT_ERRORS.scannerUnavailable,
}

const CAPTURE_CODE_MESSAGES: Record<string, string> = {
  HTTP_FORBIDDEN: AUDIT_ERRORS.siteBlocked,
  HTTP_RATE_LIMIT: AUDIT_ERRORS.rateLimited,
  HTTP_ERROR: AUDIT_ERRORS.unreachable,
  NON_HTML_RESPONSE: AUDIT_ERRORS.notHtml,
  CAPTURE_FAILED: AUDIT_ERRORS.captureFailed,
}

/** Map internal failure codes to user-safe copy. Never show raw backend messages. */
export function getUserFacingAuditError(failureCode?: string | null): string {
  if (failureCode && FAILURE_CODE_MESSAGES[failureCode]) {
    return FAILURE_CODE_MESSAGES[failureCode]
  }
  return AUDIT_ERRORS.generic
}

export function getUserFacingCaptureError(code?: string | null): string {
  if (code && CAPTURE_CODE_MESSAGES[code]) {
    return CAPTURE_CODE_MESSAGES[code]
  }
  return AUDIT_ERRORS.captureFailed
}

export function getUserFacingPageSpeedError(): string {
  return AUDIT_ERRORS.pageSpeedUnavailable
}

export function getUserFacingPartialAiError(): string {
  return AUDIT_ERRORS.partialAiReview
}
