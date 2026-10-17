import { z } from 'zod'
import { journeyEvaluationSchema, type JourneyEvaluation } from './evaluator-schema'
import type { JourneyStepDraft } from './types'

const rejectionSchema = z.object({
  kind: z.enum(['frictionPoints', 'brokenPromises', 'accessibilityBarriers']),
  index: z.number().int().nonnegative(), stepNumber: z.number().int().positive(),
  reason: z.enum(['missing_step', 'missing_reference', 'reference_mismatch', 'unobserved_action',
    'unestablished_progress', 'unsupported_accessibility', 'unobserved_promise']),
}).strict()
export const journeyAssessmentSchema = z.object({
  version: z.literal(1), journeyType: z.string().max(100), state: z.enum(['COMPLETE', 'INCOMPLETE']),
  reason: z.enum(['assessed', 'unsupported_candidates', 'provider_failed', 'budget_unavailable']),
  evaluation: journeyEvaluationSchema.optional(),
  rejections: z.array(rejectionSchema).max(20),
}).strict()
export type JourneyAssessment = z.infer<typeof journeyAssessmentSchema>
type Candidate = JourneyEvaluation['frictionPoints'][number] | JourneyEvaluation['brokenPromises'][number] | JourneyEvaluation['accessibilityBarriers'][number]
const normalized = (value: string) => value.replace(/\s+/g, ' ').trim()

function sourceText(step: JourneyStepDraft, source: NonNullable<Candidate['evidenceRefs']>[number]['source']): string {
  switch (source) {
    case 'accessibilityTree': return step.accessibilityTree.slice(0, 12_000)
    case 'actionDetail': return JSON.stringify(step.actionDetail)
    case 'elementDescription': return step.elementDescription ?? ''
    case 'outcomeDetail': return step.outcomeDetail ?? ''
    case 'consoleErrors': return (step.consoleErrors ?? []).join('; ')
    case 'networkErrors': return (step.networkErrors ?? []).join('; ')
  }
}

/** Quote custody alone is insufficient. Validate the claimed condition before admission. */
export function assessJourneyEvaluation(evaluation: JourneyEvaluation, steps: JourneyStepDraft[], journeyType = 'multi-step-funnel') {
  const rejections: JourneyAssessment['rejections'] = []
  const byNumber = new Map(steps.map(step => [step.stepNumber, step]))
  function reasonFor(candidate: Candidate): JourneyAssessment['rejections'][number]['reason'] | undefined {
    const step = byNumber.get(candidate.stepNumber)
    if (!step) return 'missing_step'
    const refs = candidate.evidenceRefs
    if (!refs?.length || !refs.some(ref => ref.stepNumber === candidate.stepNumber && ref.source === 'accessibilityTree')) return 'missing_reference'
    if (refs.some(ref => !byNumber.has(ref.stepNumber) || !normalized(sourceText(byNumber.get(ref.stepNumber)!, ref.source)).includes(normalized(ref.quote)))) return 'reference_mismatch'
    const treeRefs = refs.filter(ref => ref.stepNumber === candidate.stepNumber && ref.source === 'accessibilityTree')
    if ('type' in candidate) {
      // Current journey facts contain no post-action feedback measurement. Loading
      // outcomeMatch and a screenshot URL cannot manufacture that measurement.
      if (candidate.type === 'missing-feedback') return 'unobserved_action'
      if (['unclear-progress', 'too-many-steps'].includes(candidate.type) &&
        !treeRefs.some(ref => /\bstep\s+\d+\s*(?:of|\/)\s*\d+\b|\bprogressbar\b/i.test(ref.quote))) return 'unestablished_progress'
    } else if ('barrier' in candidate) {
      const element = normalized(candidate.element)
      if (!element || !normalized(step.accessibilityTree).includes(element)) return 'unsupported_accessibility'
      const claim = `${candidate.barrier} ${candidate.evidence}`
      if (/\b(accessible name|label|unnamed|alt text)\b/i.test(claim)) {
        const unnamed = step.accessibilityTree.split('\n').map(line => line.trim()).filter(line =>
          /^- (?:textbox|button|link|checkbox|combobox|radio|slider|spinbutton|img)(?: "")?(?: \[.*\])?:?$/.test(line))
        if (!unnamed.some(line => [normalized(line), normalized(line.replace(/^- /, ''))].includes(element) &&
          treeRefs.some(ref => ref.quote.split('\n').some(quotedLine => normalized(quotedLine) === normalized(line))))) return 'unsupported_accessibility'
      } else if (/\b(heading|outline|skipped level)\b/i.test(claim)) {
        const headings = [...step.accessibilityTree.matchAll(/^\s*(- heading .*\[level=(\d+)\])/gm)].map(match => ({ line: normalized(match[1]), level: Number(match[2]) }))
        if (!headings.some((heading, index) => index > 0 && heading.level > headings[index - 1].level + 1 &&
          heading.line.includes(element) && treeRefs.some(ref => normalized(ref.quote).includes(heading.line)))) return 'unsupported_accessibility'
      } else return 'unsupported_accessibility'
    } else {
      const previous = steps.filter(item => item.stepNumber < step.stepNumber).sort((a, b) => b.stepNumber - a.stepNumber).slice(0, 1)
        .filter(item => item.url !== step.url)
      if (!previous.length || !['click', 'navigate'].includes(step.actionType) ||
        typeof step.actionDetail.text !== 'string' || normalized(step.actionDetail.text) !== normalized(candidate.expected)) return 'unobserved_promise'
      if (normalized(candidate.expected) === normalized(candidate.actual) || step.accessibilityTree.split('\n').some(line =>
        /^\s*- heading /.test(line) && line.includes(`"${candidate.expected}"`))) return 'unobserved_promise'
      const primaryHeading = step.accessibilityTree.match(/^\s*- heading "((?:\\.|[^"\\])*)" \[level=1\]/m)
      if (!primaryHeading || normalized(primaryHeading[1]) !== normalized(candidate.actual)) return 'unobserved_promise'
      const visible = refs.filter(ref => ref.source === 'accessibilityTree')
      if (!visible.some(ref => ref.stepNumber < step.stepNumber && previous.some(item => item.stepNumber === ref.stepNumber) && ref.quote.includes(candidate.expected)) ||
        !visible.some(ref => ref.stepNumber === step.stepNumber && ref.quote.includes(candidate.actual))) return 'unobserved_promise'
    }
  }
  function admitted<T extends Candidate>(kind: JourneyAssessment['rejections'][number]['kind'], candidates: T[]): T[] {
    return candidates.filter((candidate, index) => {
      const reason = reasonFor(candidate)
      if (!reason) return true
      rejections.push({ kind, index, stepNumber: candidate.stepNumber, reason })
      return false
    })
  }
  const grounded: JourneyEvaluation = { ...evaluation,
    frictionPoints: admitted('frictionPoints', evaluation.frictionPoints),
    brokenPromises: admitted('brokenPromises', evaluation.brokenPromises),
    accessibilityBarriers: admitted('accessibilityBarriers', evaluation.accessibilityBarriers) }
  const assessment: JourneyAssessment = { version: 1, journeyType, evaluation,
    state: rejections.length ? 'INCOMPLETE' : 'COMPLETE', reason: rejections.length ? 'unsupported_candidates' : 'assessed', rejections }
  return { evaluation: grounded, assessment }
}

/** Customer evidence comes from exact recorded references, not a model paraphrase. */
export function recordedJourneyEvidence(candidate: Candidate): string {
  return (candidate.evidenceRefs ?? []).map(ref => `Step ${ref.stepNumber}, ${ref.source}: ${ref.quote}`).join('\n')
}

/** Historical artifacts keep their original meaning; declared malformed assessments fail closed. */
export function hasIncompleteJourneyAssessment(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || !('data' in raw)) return false
  const data = raw.data
  if (!data || typeof data !== 'object' || !('assessments' in data)) return false
  const parsed = z.array(journeyAssessmentSchema).max(6).safeParse(data.assessments)
  return !parsed.success || parsed.data.some(assessment => assessment.state === 'INCOMPLETE')
}
