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
        {
          flagKey: 'flag-a',
          evidence: 'The page title is missing, showing generic browser default text instead of a descriptive headline.',
          whyItMatters: 'Without a descriptive title, visitors cannot understand what the page offers, reducing click-through rates from search results.',
          fix: '1. Open your page layout file and locate the <title> tag in the <head> section.\n2. Replace the generic text with a specific description: <title>Your Product Name - Key Benefit</title>',
          verificationRule: 'Reload the page and check the browser tab shows your new title',
        },
        {
          flagKey: 'flag-b',
          evidence: 'The primary CTA button text reads "Submit" which is generic and does not communicate the value of clicking.',
          whyItMatters: 'Vague button text reduces conversion rates because visitors do not know what they will get after clicking.',
          fix: '1. Find the <button> element with text "Submit" in your form component.\n2. Change the button text to a benefit-focused label like "Start Free Trial" or "Get My Quote".',
          verificationRule: 'Check the button now displays the new action-oriented text',
        },
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

  it('soft-drops mismatched agentPrompt instead of aborting the job', () => {
    const output = {
      flagPrescriptions: [
        {
          flagKey: 'flag-a',
          evidence: 'The page title is missing, showing generic browser default text instead of a descriptive headline.',
          whyItMatters: 'Without a descriptive title, visitors cannot understand what the page offers, reducing click-through rates from search results.',
          fix: '1. Open your page layout file and locate the <title> tag in the <head> section.\n2. Replace the generic text with a specific description: <title>Your Product Name - Key Benefit</title>',
          agentPrompt: 'Add aria-labels to every button and test with a screen reader across the whole app.',
          verificationRule: 'Reload the page and check the browser tab shows your new title',
        },
      ],
      rubricPrescriptions: [
        { name: 'MESSAGE' as const, rubricPrompt: 'r' },
        { name: 'EXPERIENCE' as const, rubricPrompt: 'r' },
        { name: 'REACH' as const, rubricPrompt: 'r' },
      ],
    }
    const existing = {
      flagKey: 'flag-a',
      problem: 'Title tag is missing',
      evidence: 'Browser tab shows Untitled document',
      checkId: 'title-missing',
      source: 'DETERMINISTIC',
      rubric: 'REACH',
      severity: 'IMPORTANT',
      pageUrl: 'https://example.com',
    }
    const result = validatePrescriptionOutput(output as any, [existing])
    assert.equal(result.flagPrescriptions[0]?.agentPrompt, null)
    assert.match(result.flagPrescriptions[0]?.fix ?? '', /title/i)
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
