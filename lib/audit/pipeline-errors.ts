export class AuditDeadlineError extends Error {
  readonly code = 'AUDIT_TIMEOUT' as const
  readonly stage: string

  constructor(stage: string) {
    super(`Audit timed out during ${stage}`)
    this.name = 'AuditDeadlineError'
    this.stage = stage
  }
}

export function isNonRetryableAuditError(error: unknown): boolean {
  if (error instanceof AuditDeadlineError) return true
  if (error instanceof Error) {
    if (error.message.includes('Desktop screenshot capture failed')) return true
    if (error.message.includes('ANTHROPIC_API_KEY') || error.message.includes('OPENAI_API_KEY'))
      return true
  }
  return false
}
