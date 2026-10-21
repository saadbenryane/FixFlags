import type { OutcomeAssessmentState } from '@prisma/client'
import { assessmentIsComparable, type CurrentBindingRevision } from './domain/assessment-comparability'
import { currentOutcomeState, type CustomerOutcomeState } from './outcome-state'

type RecordedAssessment = { state: OutcomeAssessmentState; coverage: unknown; assessedAt: Date; validUntil: Date }

/** Current configuration may shorten assurance, but cannot extend a recorded
 * observation's original validity. Historical readers keep its saved deadline. */
export function currentOutcomeAssessment(input: {
  assessment: RecordedAssessment | null; bindings: CurrentBindingRevision[]; environment: string;
  staleAfterMinutes: number; now: Date;
}): { state: CustomerOutcomeState; comparable: boolean; assessedAt: Date | null; validUntil: Date | null } {
  const assessment = input.assessment
  const comparable = Boolean(assessment && assessmentIsComparable(assessment.coverage, input.bindings, input.environment))
  if (!assessment || !comparable) return { state: 'COULD_NOT_VERIFY', comparable, assessedAt: null, validUntil: null }
  const observedAt = assessment.assessedAt?.getTime(), recordedUntil = assessment.validUntil?.getTime()
  if (!Number.isFinite(observedAt) || !Number.isFinite(recordedUntil) || !Number.isSafeInteger(input.staleAfterMinutes) || input.staleAfterMinutes <= 0)
    return { state: 'COULD_NOT_VERIFY', comparable, assessedAt: null, validUntil: null }
  const validUntil = new Date(Math.min(recordedUntil, observedAt + input.staleAfterMinutes * 60_000))
  return { state: currentOutcomeState({ ...assessment, validUntil }, input.now), comparable,
    assessedAt: assessment.assessedAt, validUntil }
}
