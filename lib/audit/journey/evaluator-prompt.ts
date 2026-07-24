import type { JourneyStepDraft } from './types'

/**
 * Byte-identical across all audits for prompt cache reuse.
 * User-specific data goes in the user prompt.
 */
export function buildEvaluatorSystemPrompt(): string {
  return `You are a UX journey evaluator. You analyze completed user journeys through websites to identify experience problems.

Your job is to evaluate the step-by-step history of a user journey and identify:
- **Friction points**: hesitation, confusion, too many steps, unclear progress, missing feedback
- **Broken promises**: when the page promised something but delivered something different
- **Accessibility barriers**: elements that would prevent users with disabilities from completing the journey

Rules:
1. Only report issues you can directly observe from the evidence (screenshots, accessibility trees, step URLs).
2. Every finding must reference a specific step number.
3. Be specific about WHAT is wrong and WHY it matters.
4. Do not report subjective opinions - only observable evidence-backed issues.
5. Severity should reflect real business impact:
   - CRITICAL: Blocks conversion or loses visitors immediately
   - IMPORTANT: Creates significant friction but does not block conversion
   - POLISH: Minor improvement opportunity
6. Each friction point should map to the correct rubric:
   - MESSAGE: Clarity, copy, value proposition issues
   - EXPERIENCE: Navigation, interaction, conversion flow issues
   - REACH: Discoverability, SEO, sharing issues
7. Accessibility barriers should reference specific a11y tree elements.
8. Keep confidence calibrated - lower confidence when evidence is ambiguous.

Focus on the PRIMARY conversion path. Do not flag minor cosmetic issues. Focus on issues that would cause real users to abandon or fail to convert.`
}

export interface EvaluatorUserPromptInput {
  url: string
  journeyType: string
  goalAchieved: boolean
  steps: JourneyStepDraft[]
  summary: string
}

/**
 * Per-audit user prompt. Contains the specific journey data for evaluation.
 */
export function buildEvaluatorUserPrompt(input: EvaluatorUserPromptInput): string {
  const stepsSection = input.steps
    .map((s) => {
      const evidence: string[] = []
      if (s.screenshotAfterUrl) evidence.push(`screenshot: ${s.screenshotAfterUrl}`)
      if (s.url) evidence.push(`url: ${s.url}`)
      if (s.elementDescription) evidence.push(`element: ${s.elementDescription}`)
      if (s.accessibilityTree) evidence.push(`a11y tree: ${s.accessibilityTree.slice(0, 800)}`)
      if (s.consoleErrors?.length) evidence.push(`console errors: ${s.consoleErrors.join('; ')}`)
      if (s.networkErrors?.length) evidence.push(`network errors: ${s.networkErrors.join('; ')}`)
      if (s.outcomeMatch === false) evidence.push(`outcome: MISMATCH - ${s.outcomeDetail}`)
      if (s.loadTimeMs && s.loadTimeMs > 5000) evidence.push(`slow load: ${s.loadTimeMs}ms`)

      return `Step ${s.stepNumber} [${s.actionType}]:
  URL: ${s.url}
  Action: ${s.reasoning || `${s.actionType} toward ${JSON.stringify(s.actionDetail)}`}
  ${evidence.length > 0 ? `Evidence:\n  ${evidence.join('\n  ')}` : 'No additional evidence'}`
    })
    .join('\n\n')

  return `Website: ${input.url}
Journey type: ${input.journeyType}
Goal achieved: ${input.goalAchieved ? 'Yes' : 'No'}
Steps completed: ${input.steps.length}

${input.summary ? `Journey summary: ${input.summary}` : ''}

Step-by-step history:
${stepsSection}

Evaluate this journey for UX issues. Focus on friction points, broken promises, and accessibility barriers.`
}
