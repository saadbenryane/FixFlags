import type { JourneyStepDraft } from './types'

/** Historical planner expectations remain stored, but cannot ground findings. */
export function observedJourneyActionDetail(step: Pick<JourneyStepDraft, 'actionDetail'>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(step.actionDetail).filter(([key]) =>
    !['expectedResult', 'planTarget', 'reasoning'].includes(key)))
}
