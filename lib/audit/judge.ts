/**
 * Shared retry predicate for the triage and prescription judges.
 *
 * The legacy single-pass judge (runJudgeWithRetry + provider callers) that used
 * to live here was removed when the pipeline moved to the two-phase design
 * (see judge-triage.ts and judge-prescription.ts). Only this shared error
 * classifier remains, imported by both phases.
 */
export function isRetryableJudgeError(err: unknown): boolean {
  if (!(err instanceof Error)) return false
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
