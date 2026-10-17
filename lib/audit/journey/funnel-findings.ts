import type { JourneyFindingDraft } from './types'
import { whyItMattersForCheckId } from '../flag-copy'

type DestinationFacts = {
  currentStep: number; currentUrl: string; maxSteps: number
  isLoading: boolean; hasContent: boolean; headlinePassed: boolean; primaryActionFound: boolean
  screenshotUrl?: string | null; accessibilityEvidence?: string | null
}

/** Interpret single destination samples without inventing persistence, missing markup, or customer behavior. */
export function assessFunnelDestination(facts: DestinationFacts): JourneyFindingDraft[] {
  const findings: JourneyFindingDraft[] = []
  const add = (draft: Pick<JourneyFindingDraft, 'checkId' | 'conditionId' | 'rubric' | 'severity' | 'impactTag' | 'problem' | 'evidence' | 'fix' | 'findingType'>) => {
    findings.push({ ...draft, source: 'JOURNEY', stepNumber: facts.currentStep, url: facts.currentUrl,
      whyItMatters: whyItMattersForCheckId(draft.checkId), confidence: 0.85,
      screenshotUrl: facts.screenshotUrl, accessibilityEvidence: facts.accessibilityEvidence })
  }
  if (facts.isLoading) add({
    checkId: 'journey-funnel-timeout', conditionId: 'journey-funnel-timeout', rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'FRICTION',
    problem: 'Loading UI was present at the checked destination',
    evidence: `Reproduced at step ${facts.currentStep}. Page at ${facts.currentUrl} had recognized loading UI at the observation point. Continuous loading was not measured.`,
    fix: '1. Inspect the recorded loading state and navigation timing\n2. Reproduce whether loading persists before changing its dependencies\n3. Recheck the original route after any repair', findingType: 'friction',
  })
  if (!facts.hasContent && !facts.isLoading) add({
    checkId: 'journey-funnel-dead-end', conditionId: 'missing-content', rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'FRICTION',
    problem: 'No recognized substantive content at the checked destination',
    evidence: `Reproduced at step ${facts.currentStep}. Page at ${facts.currentUrl} did not satisfy the substantive-content check at the observation point.`,
    fix: '1. Inspect the original response and rendered content\n2. Reproduce any rendering failure before changing the page\n3. Recheck the same destination after any repair', findingType: 'dead-end',
  })
  if (!facts.headlinePassed && facts.currentStep >= 2) add({
    checkId: 'journey-funnel-unclear-progress', conditionId: 'journey-funnel-unclear-progress', rubric: 'MESSAGE', severity: 'POLISH', impactTag: 'CLARITY',
    problem: 'Review the destination H1 and its supporting context',
    evidence: `Reproduced at step ${facts.currentStep}. The destination H1 did not satisfy the recorded completeness and 12-character check on ${facts.currentUrl}. This does not establish that no H1 exists.`,
    fix: '1. Inspect the recorded H1 and nearby supporting copy\n2. Review the audience, page purpose, and preceding action together\n3. Change the wording only where that context supports a clearer next step', findingType: 'confusion',
  })
  if (!facts.primaryActionFound && facts.currentStep >= 2 && facts.currentStep < facts.maxSteps) add({
    checkId: 'journey-funnel-missing-feedback', conditionId: 'journey-funnel-missing-feedback', rubric: 'EXPERIENCE', severity: 'IMPORTANT', impactTag: 'CONVERSION',
    problem: 'Review the next action at the checked destination',
    evidence: `Reproduced at step ${facts.currentStep}. After navigating to ${facts.currentUrl}, no recognized primary CTA was detected. Post-action feedback was not measured.`,
    fix: '1. Inspect the destination and preceding action together\n2. Review whether this page needs a continuation\n3. Provide a next action where the intended task requires one', findingType: 'friction',
  })
  return findings
}
