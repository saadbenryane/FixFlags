export class AuditDeadlineError extends Error {
  readonly code = 'AUDIT_TIMEOUT' as const
  readonly stage: string

  constructor(stage: string) {
    super(`Audit timed out during ${stage}`)
    this.name = 'AuditDeadlineError'
    this.stage = stage
  }
}

/**
 * The headless browser could not be launched. This is an infrastructure problem
 * on our side (missing/incompatible Chromium, OOM, sandbox), NOT the target site
 * being unreachable. Keep it distinct so we never blame the user's site for it.
 */
export class BrowserLaunchError extends Error {
  readonly code = 'BROWSER_LAUNCH_FAILED' as const

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'BrowserLaunchError'
    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/** Screenshot storage (R2) is not configured. Audits cannot persist captures. */
export class StorageNotConfiguredError extends Error {
  readonly code = 'STORAGE_NOT_CONFIGURED' as const

  constructor(message: string) {
    super(message)
    this.name = 'StorageNotConfiguredError'
  }
}

/** Screenshot storage is configured but the upload failed (network, auth, bucket). */
export class StorageUploadError extends Error {
  readonly code = 'STORAGE_UPLOAD_FAILED' as const

  constructor(message: string, options?: { cause?: unknown }) {
    super(message)
    this.name = 'StorageUploadError'
    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

/** Infra failures that are on our side, not the target site's. */
export function isInfrastructureAuditError(error: unknown): boolean {
  return (
    error instanceof BrowserLaunchError ||
    error instanceof StorageNotConfiguredError ||
    error instanceof StorageUploadError
  )
}

/**
 * The destination site is unreachable, refuses the audit, or is not an HTML
 * page. This is a property of the target (or its hosting), not a FixFlags bug.
 * Carries a clear, user-facing message and a specific failure code so the
 * report UI can explain why no report was produced and the worker does NOT
 * waste queue budget retrying a dead URL.
 */
export class SiteOutageError extends Error {
  readonly code = 'SITE_OUTAGE' as const
  readonly failureCode: string
  readonly failureMessage: string

  constructor(failureCode: string, failureMessage: string, throwMessage: string) {
    super(throwMessage)
    this.name = 'SiteOutageError'
    this.failureCode = failureCode
    this.failureMessage = failureMessage
  }
}

/**
 * Map a thrown error to the audit-level failure code. Falls back to the generic
 * pipeline code so the catch-all path is unchanged for genuinely unknown errors.
 */
export function auditFailureCodeFromError(error: unknown): string {
  if (error instanceof AuditDeadlineError) return 'AUDIT_TIMEOUT'
  if (error instanceof BrowserLaunchError) return 'BROWSER_LAUNCH_FAILED'
  if (error instanceof StorageNotConfiguredError) return 'STORAGE_NOT_CONFIGURED'
  if (error instanceof StorageUploadError) return 'STORAGE_UPLOAD_FAILED'
  if (error instanceof SiteOutageError) return error.failureCode
  return 'AUDIT_PIPELINE_FAILED'
}

export function isNonRetryableAuditError(error: unknown): boolean {
  if (error instanceof AuditDeadlineError) return true
  // Retrying without an operator fixing config/infra just burns the queue.
  if (isInfrastructureAuditError(error)) return true
  // A dead/forbidden/non-HTML site will not become scannable by retrying.
  if (error instanceof SiteOutageError) return true
  if (error instanceof Error) {
    if (error.message.includes('Desktop screenshot capture failed')) return true
    if (error.message.includes('ANTHROPIC_API_KEY') || error.message.includes('OPENAI_API_KEY'))
      return true
  }
  return false
}
