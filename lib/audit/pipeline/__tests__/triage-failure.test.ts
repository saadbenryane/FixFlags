import assert from 'node:assert/strict'
import { describe, it } from 'vitest'
import { AuditDeadlineError } from '../../pipeline-errors'
import { JudgeContractError } from '../../validate-judge-output'
import { parseTriageFailure, triageFailureCode } from '../triage-failure'

describe('parseTriageFailure', () => {
  it('maps deadline errors to deadline_exhausted, non-retryable', () => {
    const failure = parseTriageFailure(new AuditDeadlineError('ran out of time'))
    assert.equal(failure.reason, 'deadline_exhausted')
    assert.equal(failure.retryable, false)
    assert.match(failure.message, /ran out of time/)
  })

  it('maps missing provider keys to no_provider_keys', () => {
    assert.equal(parseTriageFailure(new Error('api_key is not configured for openai')).reason, 'no_provider_keys')
    assert.equal(parseTriageFailure(new Error('No providers available for triage')).reason, 'no_provider_keys')
  })

  it('maps contract errors to contract_invalid', () => {
    const failure = parseTriageFailure(new JudgeContractError('schema mismatch'))
    assert.equal(failure.reason, 'contract_invalid')
    assert.equal(failure.retryable, false)
    assert.equal(parseTriageFailure(new Error('invalid triage output: missing flags')).reason, 'contract_invalid')
  })

  it('maps rate limit and timeout messages to retryable provider_exhausted', () => {
    for (const message of [
      'Rate limit exceeded for model',
      'Provider returned 429',
      'request timeout after 30s',
      'The operation was aborted',
      'triage failed with 500 from provider',
    ]) {
      const failure = parseTriageFailure(new Error(message))
      assert.equal(failure.reason, 'provider_exhausted', message)
      assert.equal(failure.retryable, true, message)
    }
  })

  it('falls back to unknown for anything else', () => {
    const failure = parseTriageFailure('a plain string error')
    assert.equal(failure.reason, 'unknown')
    assert.equal(failure.retryable, false)
    assert.equal(failure.message, 'a plain string error')
  })
})

describe('triageFailureCode', () => {
  it('maps each reason to its stable code', () => {
    assert.equal(triageFailureCode('no_provider_keys'), 'AI_PROVIDER_NOT_CONFIGURED')
    assert.equal(triageFailureCode('deadline_exhausted'), 'AUDIT_TIMEOUT')
    assert.equal(triageFailureCode('contract_invalid'), 'AI_CONTRACT_INVALID')
    assert.equal(triageFailureCode('provider_exhausted'), 'AUDIT_PIPELINE_FAILED')
    assert.equal(triageFailureCode('unknown'), 'AUDIT_PIPELINE_FAILED')
  })
})
