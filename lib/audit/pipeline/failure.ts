import {
  AuditDeadlineError,
  auditFailureCodeFromError,
  isInfrastructureAuditError,
} from '../pipeline-errors'
import { JudgeContractError } from '../validate-judge-output'

export interface AuditFailure {
  failureCode: string
  failureStage: string
}

/**
 * Single source of truth for mapping a pipeline error to its persisted failure
 * taxonomy. Deadline and AI-contract errors carry their own stage/code; for
 * everything else the caller supplies the stage it was in when the error fired.
 */
export function deriveAuditFailure(error: unknown, fallbackStage: string): AuditFailure {
  if (error instanceof AuditDeadlineError) {
    return { failureCode: 'AUDIT_TIMEOUT', failureStage: error.stage }
  }
  if (error instanceof JudgeContractError) {
    return { failureCode: 'AI_CONTRACT_INVALID', failureStage: fallbackStage }
  }
  // Browser/storage failures are our infrastructure, not the target site, so
  // they get distinct codes (BROWSER_LAUNCH_FAILED / STORAGE_*) and never show
  // the "site unreachable" copy.
  if (isInfrastructureAuditError(error)) {
    return { failureCode: auditFailureCodeFromError(error), failureStage: fallbackStage }
  }
  return { failureCode: 'AUDIT_PIPELINE_FAILED', failureStage: fallbackStage }
}
