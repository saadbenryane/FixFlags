import { describe, it } from 'vitest'
/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict'
import { isRetryableJudgeError } from '@/lib/audit/judge'
import { validatePrescriptionOutput } from '@/lib/audit/judge-prescription'
import { JudgeContractError } from '@/lib/audit/validate-judge-output'

describe('isRetryableJudgeError', () => {
  it('returns false for non-Error input', () => {
    assert.equal(isRetryableJudgeError(null), false)
    assert.equal(isRetryableJudgeError(undefined), false)
    assert.equal(isRetryableJudgeError('string error'), false)
    assert.equal(isRetryableJudgeError(42), false)
    assert.equal(isRetryableJudgeError({}), false)
  })

  it('returns true for AbortError', () => {
    const err = new Error('Request was aborted')
    err.name = 'AbortError'
    assert.equal(isRetryableJudgeError(err), true)
  })

  it('returns true for overloaded errors', () => {
    assert.equal(isRetryableJudgeError(new Error('model is overloaded')), true)
    assert.equal(isRetryableJudgeError(new Error('Overloaded capacity')), true)
  })

  it('returns true for rate limit errors', () => {
    assert.equal(isRetryableJudgeError(new Error('rate limit exceeded')), true)
    assert.equal(isRetryableJudgeError(new Error('Rate Limit: too many requests')), true)
  })

  it('returns true for timeout errors', () => {
    assert.equal(isRetryableJudgeError(new Error('request timeout')), true)
    assert.equal(isRetryableJudgeError(new Error('timeout exceeded after 30s')), true)
  })

  it('returns true for aborted errors', () => {
    assert.equal(isRetryableJudgeError(new Error('operation aborted')), true)
    assert.equal(isRetryableJudgeError(new Error('Aborted due to user intervention')), true)
  })

  it('returns true for HTTP 503, 529, 429 status codes', () => {
    assert.equal(isRetryableJudgeError(new Error('503 Service Unavailable')), true)
    assert.equal(isRetryableJudgeError(new Error('HTTP 529 too many requests')), true)
    assert.equal(isRetryableJudgeError(new Error('429 Too Many Requests')), true)
  })

  it('returns false for non-retryable errors', () => {
    assert.equal(isRetryableJudgeError(new Error('invalid API key')), false)
    assert.equal(isRetryableJudgeError(new Error('400 Bad Request')), false)
    assert.equal(isRetryableJudgeError(new Error('insufficient credits')), false)
    assert.equal(isRetryableJudgeError(new Error('model not found')), false)
    assert.equal(isRetryableJudgeError(new Error('context length exceeded')), false)
  })
})

describe('validatePrescriptionOutput', () => {
  const makeFlag = (flagKey: string): any => ({ flagKey, id: `id-${flagKey}` })

  it('passes when outputs match existing flags exactly', () => {
    const output = {
      flagPrescriptions: [
        { flagKey: 'flag-a', evidence: 'e', whyItMatters: 'w', fix: 'f', verificationRule: 'v' },
        { flagKey: 'flag-b', evidence: 'e', whyItMatters: 'w', fix: 'f', verificationRule: 'v' },
      ],
      rubricPrescriptions: [
        { name: 'MESSAGE' as const, rubricPrompt: 'r' },
        { name: 'EXPERIENCE' as const, rubricPrompt: 'r' },
        { name: 'REACH' as const, rubricPrompt: 'r' },
      ],
    }
    const result = validatePrescriptionOutput(output as any, [makeFlag('flag-a'), makeFlag('flag-b')])
    assert.equal(result, output)
  })

  it('throws when flag count does not match', () => {
    const output = {
      flagPrescriptions: [{ flagKey: 'flag-a', evidence: 'e', whyItMatters: 'w', fix: 'f', verificationRule: 'v' }],
      rubricPrescriptions: [
        { name: 'MESSAGE' as const, rubricPrompt: 'r' },
        { name: 'EXPERIENCE' as const, rubricPrompt: 'r' },
        { name: 'REACH' as const, rubricPrompt: 'r' },
      ],
    }
    assert.throws(
      () => validatePrescriptionOutput(output as any, [makeFlag('flag-a'), makeFlag('flag-b')]),
      JudgeContractError
    )
  })

  it('throws when a flag key is missing from prescriptions', () => {
    const output = {
      flagPrescriptions: [
        { flagKey: 'flag-a', evidence: 'e', whyItMatters: 'w', fix: 'f', verificationRule: 'v' },
      ],
      rubricPrescriptions: [
        { name: 'MESSAGE' as const, rubricPrompt: 'r' },
        { name: 'EXPERIENCE' as const, rubricPrompt: 'r' },
        { name: 'REACH' as const, rubricPrompt: 'r' },
      ],
    }
    assert.throws(
      () => validatePrescriptionOutput(output as any, [makeFlag('flag-a'), makeFlag('flag-z')]),
      JudgeContractError
    )
  })

  it('throws when rubric prescription count is not 3', () => {
    const output = {
      flagPrescriptions: [{ flagKey: 'flag-a', evidence: 'e', whyItMatters: 'w', fix: 'f', verificationRule: 'v' }],
      rubricPrescriptions: [
        { name: 'MESSAGE' as const, rubricPrompt: 'r' },
      ],
    }
    assert.throws(
      () => validatePrescriptionOutput(output as any, [makeFlag('flag-a')]),
      JudgeContractError
    )
  })

  it('throws when rubric prescription count is 0', () => {
    const output = {
      flagPrescriptions: [{ flagKey: 'flag-a', evidence: 'e', whyItMatters: 'w', fix: 'f', verificationRule: 'v' }],
      rubricPrescriptions: [],
    }
    assert.throws(
      () => validatePrescriptionOutput(output as any, [makeFlag('flag-a')]),
      JudgeContractError
    )
  })

  it('handles empty existing flags', () => {
    const output = {
      flagPrescriptions: [],
      rubricPrescriptions: [
        { name: 'MESSAGE' as const, rubricPrompt: 'r' },
        { name: 'EXPERIENCE' as const, rubricPrompt: 'r' },
        { name: 'REACH' as const, rubricPrompt: 'r' },
      ],
    }
    const result = validatePrescriptionOutput(output as any, [])
    assert.equal(result, output)
  })
})
