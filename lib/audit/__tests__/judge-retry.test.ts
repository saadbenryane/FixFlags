import { describe, it } from 'vitest'
/* eslint-disable @typescript-eslint/no-explicit-any */
import assert from 'node:assert/strict'
import { isRetryableJudgeError } from '@/lib/audit/judge'
import { validatePrescriptionOutput, prescriptionFlagBatches, prescriptionTaskPlans } from '@/lib/audit/judge-prescription'
import { parsePrescriptionGuidance } from '@/lib/audit/prescription-guidance-schema'
import type { ExistingFlagForPrescription } from '@/lib/audit/flag-types'
import { REPAIR_GUIDANCE_COPY } from '@/lib/marketing/copy/repair-guidance'

describe('guidance validates repairs against immutable admitted facts', () => {
  const source: ExistingFlagForPrescription = { flagKey: 'about-headline', source: 'AI', rubric: 'MESSAGE',
    severity: 'POLISH', attention: 'recommendation', problem: 'Review the recorded About headline', checkId: null,
    pageUrl: 'https://example.test/about', evidence: 'Headline: "About"',
    whyItMatters: 'Review the headline alongside the existing page context.',
    verificationRule: 'Inspect the same About page without certifying a visitor outcome.' }
  const plan = { inspection: 'the About headline and its surrounding page copy',
    changeCondition: 'the About headline and its existing introduction do not identify the page purpose',
    changeIfConfirmed: 'clarify the existing About headline using verified page content',
    preserve: 'accurate About page content and existing navigation' }
  const output = (input = source) => parsePrescriptionGuidance({ flagPrescriptions: { 'about-headline': plan } }, [input])

  it('accepts complete guidance for the actual short-heading condition without padding the recorded evidence', () => {
    const input = structuredClone(source), before = structuredClone(input), result = output(input)
    assert.equal(input.evidence.length, 17)
    assert.equal(validatePrescriptionOutput(result, [input]), result)
    assert.equal(result.flagPrescriptions[0].evidence, input.evidence)
    assert.deepEqual(input, before)
  })

  it.each(['evidence', 'whyItMatters', 'verificationRule'] as const)('rejects a rewritten recorded %s even when it satisfies the former length minimum', field => {
    const input = { ...source, evidence: 'The recorded About page heading is exactly "About".' }
    const result = output(input)
    result.flagPrescriptions[0][field] = 'An invented replacement statement that does not belong to this original observation.'
    assert.throws(() => validatePrescriptionOutput(result, [input]), /recorded/)
  })

  it('keeps an unrecorded explanation and verification obligation explicitly unavailable', () => {
    const input = { ...source, evidence: 'The recorded About page heading is exactly "About".', whyItMatters: undefined, verificationRule: undefined }
    const before = structuredClone(input), result = output(input)
    assert.equal(validatePrescriptionOutput(result, [input]), result)
    assert.equal(result.flagPrescriptions[0].whyItMatters, REPAIR_GUIDANCE_COPY.explanationUnavailable)
    assert.equal(result.flagPrescriptions[0].verificationRule, REPAIR_GUIDANCE_COPY.verificationUnavailable)
    assert.deepEqual(input, before)
  })
})

describe('prescription occurrence batching', () => {
  it('keeps every occurrence of one Flag key in the same batch and preserves all page evidence', () => {
    const rows = Array.from({ length: 13 }, (_, index) => ({ flagKey: `flag-${index}`, pageUrl: `/page-${index}` }))
    rows.push({ flagKey: 'flag-0', pageUrl: '/another-page' })
    const batches = prescriptionFlagBatches(rows, 12)
    assert.equal(batches.length, 2)
    assert.deepEqual(batches.flat().filter(row => row.flagKey === 'flag-0').map(row => row.pageUrl), ['/page-0', '/another-page'])
    assert.equal(batches.filter(batch => batch.some(row => row.flagKey === 'flag-0')).length, 1)
    assert.deepEqual(batches.flat().map(row => row.pageUrl).sort(), rows.map(row => row.pageUrl).sort())
    for (const batch of batches) assert.ok(new Set(batch.map(row => row.flagKey)).size <= 12)
  })

  it('does not create missing observations and rejects an invalid batch allocation', () => {
    assert.deepEqual(prescriptionFlagBatches([], 12), [[]])
    assert.throws(() => prescriptionFlagBatches([{ flagKey: 'flag-1' }], 0), /positive/)
  })

  it('keeps one unscoped task for a single batch, including repeated Flag keys', () => {
    assert.deepEqual(prescriptionTaskPlans([]), [{ index: null }])
    assert.deepEqual(prescriptionTaskPlans([{ flagKey: '' }, { flagKey: 'flag-1' }]), [{ index: null }])
    const repeated = Array.from({ length: 12 }, (_, index) => ({ flagKey: `flag-${index}` }))
    repeated.push({ flagKey: 'flag-0' })
    assert.deepEqual(prescriptionTaskPlans(repeated), [{ index: null }])
  })

  it('assigns one task to each batch once a review no longer fits one task', () => {
    const plans = prescriptionTaskPlans(Array.from({ length: 13 }, (_, index) => ({ flagKey: `flag-${index}` })))
    assert.equal(plans.length, 2)
    assert.equal(plans[0]?.index, 0)
    assert.equal(plans[0]?.flagKeys?.length, 12)
    assert.deepEqual(plans[1], { index: 1, flagKeys: ['flag-12'] })
  })
})
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
  it('rejects duplicate rubric names even when the count is three', () => {
    const rubricPrescriptions = Array.from({ length: 3 }, () => ({ name: 'MESSAGE', rubricPrompt: 'Review the message.' }))
    assert.throws(() => validatePrescriptionOutput({ flagPrescriptions: [], rubricPrescriptions } as any, []), /exactly one prescription for each rubric/)
  })
  const makeFlag = (flagKey: string, source: Partial<ExistingFlagForPrescription> = {}): any => ({
    flagKey, id: `id-${flagKey}`, source: 'DETERMINISTIC', rubric: 'REACH', severity: 'IMPORTANT',
    problem: `Recorded finding ${flagKey}`, checkId: flagKey, evidence: `Recorded evidence for ${flagKey}.`,
    whyItMatters: REPAIR_GUIDANCE_COPY.explanationUnavailable,
    verificationRule: REPAIR_GUIDANCE_COPY.verificationUnavailable, ...source,
  })

  it('refuses unqualified changes to an observed Recommendation, including its agent handoff', () => {
    const existing = { ...makeFlag('no-cta-detected'), attention: 'recommendation',
      problem: 'No captured action label matched the recognized phrases',
      evidence: 'Recorded controls include Checkout and Create account. Unrecognized labels were not established as missing or broken.',
      fix: 'Review the intended visitor action. Confirm the existing controls before changing their descriptive labels.' }
    const prescription = { flagKey: existing.flagKey, evidence: existing.evidence,
      whyItMatters: 'The existing control labels need review in their task context.',
      fix: 'Review the Checkout label and its intended task before changing it. If visitors cannot identify the next step, use a descriptive label.',
      agentPrompt: null, verificationRule: 'Inspect the recorded Checkout control and its actual destination.' }
    existing.whyItMatters = prescription.whyItMatters
    existing.verificationRule = prescription.verificationRule
    const output = { flagPrescriptions: [prescription], rubricPrescriptions: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, rubricPrompt: 'Review the recorded findings before changing them.' })) }
    assert.equal(validatePrescriptionOutput(output as any, [existing]), output)
    const formatted = { ...output, flagPrescriptions: [{ ...prescription, fix: '1. **Review** the Checkout label and intended task before changing it. If the existing controls describe their destination, keep their labels.' }] }
    assert.equal(validatePrescriptionOutput(formatted as any, [existing]), formatted)
    const unsafe = '1. Redefine existing action buttons with more recognizable labels such as Get started, Sign up, or Try now. 2. Ensure the buttons are visually prominent.'
    assert.throws(() => validatePrescriptionOutput({ ...output, flagPrescriptions: [{ ...prescription, fix: unsafe }] } as any, [existing]), /Recommendation.*conditional inspection/)
    assert.throws(() => validatePrescriptionOutput({ ...output, flagPrescriptions: [{ ...prescription, agentPrompt: 'Change the Checkout control to Get started.' }] } as any, [existing]), /Recommendation.*conditional inspection/)
  })

  it('accepts one precise action while refusing blank or nonspecific advice', () => {
    const prescription = { flagKey: 'title-missing', evidence: 'The recorded product page has an empty title tag.', whyItMatters: 'Visitors cannot identify the product in their browser tab.', fix: 'Set the empty <title> to the recorded product name.', verificationRule: 'Reload the same page and verify its title.' }
    const output = { flagPrescriptions: [prescription], rubricPrescriptions: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, rubricPrompt: 'Address the recorded findings.' })) }
    assert.equal(validatePrescriptionOutput(output as any, [makeFlag('title-missing', prescription)]), output)
    for (const fix of ['', 'Make it better.']) {
      assert.throws(() => validatePrescriptionOutput({ ...output, flagPrescriptions: [{ ...prescription, fix }] } as any, [makeFlag('title-missing', prescription)]), JudgeContractError)
    }
  })

  it('recognizes a recorded HTTP target without requiring a frontend selector', () => {
    const existing = { ...makeFlag('security-headers-missing'), problem: 'Required security headers are absent.', evidence: 'The response lacks Content-Security-Policy and Strict-Transport-Security headers.' }
    const prescription = { flagKey: existing.flagKey, evidence: existing.evidence, whyItMatters: 'The browser lacks the recorded transport and content protections.', fix: 'Configure Content-Security-Policy and Strict-Transport-Security on the response.', verificationRule: 'Fetch the same URL and verify both response headers.' }
    existing.whyItMatters = prescription.whyItMatters
    existing.verificationRule = prescription.verificationRule
    const output = { flagPrescriptions: [prescription], rubricPrescriptions: ['MESSAGE', 'EXPERIENCE', 'REACH'].map(name => ({ name, rubricPrompt: 'Address the recorded findings.' })) }
    assert.equal(validatePrescriptionOutput(output as any, [existing]), output)
    assert.throws(() => validatePrescriptionOutput({ ...output, flagPrescriptions: [{ ...prescription, fix: 'Improve the website for your customers.' }] } as any, [existing]), /lacks specificity/)
  })

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
    const result = validatePrescriptionOutput(output as any, output.flagPrescriptions.map(row => makeFlag(row.flagKey, row)))
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
      whyItMatters: output.flagPrescriptions[0].whyItMatters,
      verificationRule: output.flagPrescriptions[0].verificationRule,
    }
    output.flagPrescriptions[0].evidence = existing.evidence
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
