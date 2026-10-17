import { describe, expect, it } from 'vitest'
import { assessJourneyEvaluation, hasIncompleteJourneyAssessment } from '../evaluation-grounding'
import { journeyEvaluationProviderSchema, type JourneyEvaluation } from '../evaluator-schema'
import { buildEvaluatorUserPrompt } from '../evaluator-prompt'
import { convertEvaluationToFindings } from '../review-findings'
import type { JourneyStepDraft } from '../types'
const step: JourneyStepDraft = { stepNumber: 1, actionType: 'navigate', actionDetail: { href: '/signup', submitted: false },
  url: 'https://example.test/signup', reasoning: 'Inspect signup form',
  accessibilityTree: '- main:\n  - navigation:\n  - heading "Create account" [level=1]\n  - textbox "Email"\n  - textbox "Password"\n  - button "Create account"',
  outcomeMatch: true, outcomeDetail: 'Page loaded with substantive content' }
const ref = (quote: string, stepNumber = 1) => ({ stepNumber, source: 'accessibilityTree' as const, quote })
const empty = (): JourneyEvaluation => ({ frictionPoints: [], brokenPromises: [], accessibilityBarriers: [], confidence: 0.8, summary: 'Recorded facts reviewed.' })
const friction = (type: JourneyEvaluation['frictionPoints'][number]['type']) => ({ stepNumber: 1, type,
  description: 'Review the next action', evidence: 'The recorded page offers Create account.', severity: 'POLISH' as const,
  rubric: 'EXPERIENCE' as const, impactTag: 'FRICTION' as const, evidenceRefs: [ref('button "Create account"')] })
describe('journey assessment evidence custody and condition validation', () => {
  it('rejects nonexistent steps and legacy unanchored narrative on new admission', () => {
    const unanchored = { ...friction('confusion'), evidenceRefs: undefined }
    const evaluation = { ...empty(), frictionPoints: [unanchored, { ...friction('confusion'), stepNumber: 99 }] }
    const result = assessJourneyEvaluation(evaluation, [step])
    expect(result.evaluation.frictionPoints).toEqual([])
    expect(result.assessment.rejections.map(item => item.reason)).toEqual(['missing_reference', 'missing_step'])
    expect(result.assessment.evaluation).toEqual(evaluation)
    expect(result.assessment.state).toBe('INCOMPLETE')
    expect(convertEvaluationToFindings(evaluation, [step], step.url)).toEqual([])
  })
  it('does not accept a correct quote as proof of a contradicted missing-name or landmark claim', () => {
    const result = assessJourneyEvaluation({ ...empty(), accessibilityBarriers: [
      { stepNumber: 1, barrier: 'Textbox is missing its accessible name', element: 'textbox "Email"', evidence: 'Missing accessible name.', evidenceRefs: [ref('textbox "Email"')] },
      { stepNumber: 1, barrier: 'Missing main landmark', element: 'main', evidence: 'Main landmark not defined.', evidenceRefs: [ref('main:')] },
    ] }, [step])
    expect(result.evaluation.accessibilityBarriers).toEqual([])
    expect(result.assessment.rejections.every(item => item.reason === 'unsupported_accessibility')).toBe(true)
  })
  it.each(['navigate', 'evaluate', 'fill', 'click'])('never substitutes %s or page loading for actual feedback observations', actionType => {
    const result = assessJourneyEvaluation({ ...empty(), frictionPoints: [friction('missing-feedback')] }, [{ ...step, actionType }])
    expect(result.evaluation.frictionPoints).toEqual([])
    expect(result.assessment.rejections[0].reason).toBe('unobserved_action')
  })
  it('does not infer form progress from a multistep walk', () => {
    const result = assessJourneyEvaluation({ ...empty(), frictionPoints: [friction('unclear-progress')] }, [step])
    expect(result.assessment.rejections[0].reason).toBe('unestablished_progress')
  })
  it('admits a scoped copy Recommendation with exact recorded evidence and keeps missing quotes explicit', () => {
    const valid = friction('confusion')
    const result = assessJourneyEvaluation({ ...empty(), frictionPoints: [valid, { ...valid, evidenceRefs: [ref('Invented page text')] }] }, [step])
    expect(result.evaluation.frictionPoints).toEqual([valid])
    const findings = convertEvaluationToFindings(result.evaluation, [step], step.url)
    expect(findings[0]).toMatchObject({ url: step.url, findingType: 'friction', evidence: 'Step 1, accessibilityTree: button "Create account"' })
    expect(result.assessment.rejections[0].reason).toBe('reference_mismatch')
  })
  it('cannot smuggle unmeasured feedback or business outcomes into a general copy Recommendation', () => {
    const candidate = { ...friction('confusion'), description: 'Missing feedback causes abandonment and reduces conversion', evidence: 'Customers abandon this broken form.' }
    const findings = convertEvaluationToFindings({ ...empty(), frictionPoints: [candidate] }, [step], step.url)
    expect(findings[0].problem).toBe('Review whether "Create account" explains the next action')
    expect(JSON.stringify(findings)).not.toMatch(/abandonment|reduces conversion|Customers abandon|Missing feedback causes/)
    expect(assessJourneyEvaluation({ ...empty(), frictionPoints: [candidate] }, [step]).assessment.evaluation?.frictionPoints[0].description).toBe(candidate.description)
  })
  it('requires a genuinely unnamed control while keeping named neighbors distinguishable', () => {
    const unnamed = { ...step, accessibilityTree: step.accessibilityTree + '\n  - textbox' }
    const result = assessJourneyEvaluation({ ...empty(), accessibilityBarriers: [{ stepNumber: 1, barrier: 'Unnamed textbox', element: '- textbox', evidence: 'The textbox has no accessible name.', evidenceRefs: [ref('- textbox')] }] }, [unnamed])
    expect(result.evaluation.accessibilityBarriers).toHaveLength(1)
  })
  it('does not use a named-neighbor reference to substantiate a different unnamed control', () => {
    const mixed = { ...step, accessibilityTree: step.accessibilityTree + '\n  - textbox' }
    const result = assessJourneyEvaluation({ ...empty(), accessibilityBarriers: [{ stepNumber: 1, barrier: 'Unnamed textbox', element: '- textbox', evidence: 'Missing accessible name.', evidenceRefs: [ref('- textbox "Email"')] }] }, [mixed])
    expect(result.evaluation.accessibilityBarriers).toEqual([])
    expect(result.assessment.rejections[0].reason).toBe('unsupported_accessibility')
  })
  it('keeps a literal earlier promise and destination different from an invented expectation', () => {
    const prior = { ...step, url: 'https://example.test/', accessibilityTree: '- link "Pricing"' }
    const current = { ...step, stepNumber: 2, actionType: 'click', actionDetail: { text: 'Pricing', href: '/journal' }, accessibilityTree: '- heading "Journal" [level=1]' }
    const promise = { stepNumber: 2, expected: 'Pricing', actual: 'Journal', evidence: 'Pricing link opens Journal.', severity: 'IMPORTANT' as const,
      evidenceRefs: [ref('link "Pricing"'), ref('heading "Journal"', 2)] }
    const result = assessJourneyEvaluation({ ...empty(), brokenPromises: [promise, { ...promise, expected: 'Free trial' }] }, [prior, current])
    expect(result.evaluation.brokenPromises).toEqual([promise])
    expect(result.assessment.rejections[0].reason).toBe('unobserved_promise')
  })
  it('does not borrow another heading gap or an unclicked promise as evidence for a different target', () => {
    const observed = { ...step, accessibilityTree: '- heading "Work" [level=1]\n- heading "Cases" [level=3]\n- heading "Contact" [level=2]' }
    const wrongTarget = { stepNumber: 1, barrier: 'Skipped heading level', element: 'heading "Contact"', evidence: 'Contact skips a level.', evidenceRefs: [ref('- heading "Contact" [level=2]')] }
    expect(assessJourneyEvaluation({ ...empty(), accessibilityBarriers: [wrongTarget] }, [observed]).evaluation.accessibilityBarriers).toEqual([])
    const first = { ...step, url: 'https://example.test/', accessibilityTree: '- link "Pricing"\n- link "Contact"' }
    const second = { ...step, stepNumber: 2, actionType: 'click', actionDetail: { text: 'Contact', href: '/journal' }, accessibilityTree: '- heading "Journal" [level=1]' }
    const unclicked = { stepNumber: 2, expected: 'Pricing', actual: 'Journal', evidence: 'Pricing promise mismatch.', severity: 'IMPORTANT' as const,
      evidenceRefs: [ref('link "Pricing"'), ref('heading "Journal"', 2)] }
    expect(assessJourneyEvaluation({ ...empty(), brokenPromises: [unclicked] }, [first, second]).evaluation.brokenPromises).toEqual([])
  })
  it('cannot call unrelated footer text the primary destination of an action', () => {
    const first = { ...step, url: 'https://example.test/', accessibilityTree: '- link "Pricing"' }
    const second = { ...step, stepNumber: 2, actionType: 'click', actionDetail: { text: 'Pricing', href: '/plans' }, accessibilityTree: '- heading "Plans and billing" [level=1]\n- link "Privacy"' }
    const candidate = { stepNumber: 2, expected: 'Pricing', actual: 'Privacy', evidence: 'Pricing opens Privacy.', severity: 'IMPORTANT' as const, evidenceRefs: [ref('link "Pricing"'), ref('link "Privacy"', 2)] }
    expect(assessJourneyEvaluation({ ...empty(), brokenPromises: [candidate] }, [first, second]).evaluation.brokenPromises).toEqual([])
  })
  it('requires references from both provider contracts while retaining historical readers', () => {
    expect(journeyEvaluationProviderSchema.safeParse({ ...empty(), frictionPoints: [{ ...friction('confusion'), evidenceRefs: undefined }] }).success).toBe(false)
  })
  it('retains incomplete assessments in the task envelope independently of native completed evidence', () => {
    const assessment = assessJourneyEvaluation({ ...empty(), frictionPoints: [friction('missing-feedback')] }, [step]).assessment
    expect(hasIncompleteJourneyAssessment({ data: { assessments: [assessment], pageReceipts: [{ complete: true }] } })).toBe(true)
    expect(hasIncompleteJourneyAssessment({ data: { assessments: [{ version: 2 }] } })).toBe(true)
    expect(hasIncompleteJourneyAssessment({ data: { pageReceipts: [{ complete: true }] } })).toBe(false)
    expect(hasIncompleteJourneyAssessment({ data: { assessments: [assessJourneyEvaluation(empty(), [step]).assessment] } })).toBe(false)
  })
  it('always sends actual actionDetail beside reasoning and marks tree/pixel limitations', () => {
    const prompt = buildEvaluatorUserPrompt({ url: step.url, journeyType: 'signup', goalAchieved: false, steps: [{ ...step, screenshotAfterUrl: '/private.png', accessibilityTree: 'x'.repeat(12_001) }], summary: '' })
    expect(prompt).toContain('"submitted":false')
    expect(prompt).toContain('Runner reasoning (intent, not observation): Inspect signup form')
    expect(prompt).toContain('[TRUNCATED]')
    expect(prompt).toContain('pixels not supplied')
  })
})
