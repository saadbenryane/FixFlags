import { describe, it, expect } from 'vitest'
import { deriveAuditFailure } from '../pipeline/failure'
import { AuditDeadlineError } from '../pipeline-errors'
import { JudgeContractError } from '../validate-judge-output'

describe('deriveAuditFailure', () => {
  it('maps a deadline error to AUDIT_TIMEOUT and carries its own stage', () => {
    const result = deriveAuditFailure(new AuditDeadlineError('judging'), 'checking')
    expect(result).toEqual({ failureCode: 'AUDIT_TIMEOUT', failureStage: 'judging' })
  })

  it('maps a judge contract error to AI_CONTRACT_INVALID with the fallback stage', () => {
    const result = deriveAuditFailure(new JudgeContractError('bad'), 'judging')
    expect(result).toEqual({ failureCode: 'AI_CONTRACT_INVALID', failureStage: 'judging' })
  })

  it('maps any other error to AUDIT_PIPELINE_FAILED with the fallback stage', () => {
    const result = deriveAuditFailure(new Error('boom'), 'capturing')
    expect(result).toEqual({ failureCode: 'AUDIT_PIPELINE_FAILED', failureStage: 'capturing' })
  })

  it('handles non-Error values', () => {
    const result = deriveAuditFailure('weird', 'unknown')
    expect(result).toEqual({ failureCode: 'AUDIT_PIPELINE_FAILED', failureStage: 'unknown' })
  })
})
