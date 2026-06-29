import { JudgeContractError } from './validate-judge-output'

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

export function isNonRetryablePipelineError(error: unknown): boolean {
  if (error instanceof AuditDeadlineError) return true
  if (error instanceof Error) {
    if (error.message.includes('Desktop screenshot capture failed')) return true
  }
  return false
}

export type FailureCode = 'AUDIT_TIMEOUT' | 'AI_CONTRACT_INVALID' | 'AUDIT_PIPELINE_FAILED'
export type FailureStage = string

export function determineFailureCode(error: unknown): FailureCode {
  if (error instanceof AuditDeadlineError) return 'AUDIT_TIMEOUT'
  if (error instanceof JudgeContractError) return 'AI_CONTRACT_INVALID'
  return 'AUDIT_PIPELINE_FAILED'
}

export function sanitizeAuditErrorMessage(message: string): string {
  return message
    .replace(/https?:\/\/[^\s]+/gi, '[url]')
    .replace(/\b[A-Z][A-Z0-9_]{2,}\b/g, (match) =>
      match.includes('API') || match.includes('KEY') ? '[config]' : match
    )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 500)
}

export function determineFailureStage(error: unknown, auditStatus: string | null, hasJudgeData: boolean): string {
  if (error instanceof AuditDeadlineError) return error.stage
  if (hasJudgeData) return 'judging'
  if (auditStatus) return auditStatus.toLowerCase()
  return 'unknown'
}

export interface PageRunEvidence {
  length: number
  desktopScreenshot: boolean
}

export function canTryPartialFinalize(pageRuns: PageRunEvidence[]): boolean {
  if (pageRuns.length === 0) return false
  return pageRuns.every((p) => p.desktopScreenshot)
}
