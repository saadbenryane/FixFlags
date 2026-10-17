import type { PagePurpose } from '@/lib/audit/page-purpose'
import { isProductPage } from '@/lib/audit/page-purpose'
import type { JourneyEvaluation } from './evaluator-schema'
import type { JourneyFindingDraft, JourneyStepDraft } from './types'
import type { runJourneyTemplate } from './run-template'
import { accessibilityBarrierFix, frictionFix } from './evaluation-fix'
import { journeyFindingIdentity } from './finding-identity'
import { runNetworkEngagementChecks } from '@/lib/audit/checks/network-engagement'
import { filterToolingPathFlags } from '@/lib/audit/tooling-path-filter'
import { baseCheckId, durableCheckId } from '../flag-identity'
import { projectedJourneyFinding } from '../checks/journey-evidence'

export type JourneyReviewDraft = Awaited<ReturnType<typeof runJourneyTemplate>>
type JourneyFindingFacts = {
  findings: ReadonlyArray<JourneyReviewDraft['findings'][number]>
  steps: ReadonlyArray<JourneyReviewDraft['steps'][number]>
  startUrl: string
  formProbe?: JourneyReviewDraft['formProbe']
}

const COMMERCIAL_PROMISE_RE =
  /\b(pricing|price\s+plan|free\s+trial|sign\s*up|service\s+menu|packaged\s+offer|buy\s+now|checkout)\b/i

/** Drop broken promises that invent commercial expectations on non-product pages. */
export function shouldKeepBrokenPromise(
  expected: string,
  actual: string,
  purpose: PagePurpose | null
): boolean {
  if (purpose == null || isProductPage(purpose)) return true
  if (COMMERCIAL_PROMISE_RE.test(expected)) return false
  if (/\b(service\s+menu|unique\s+selling|packaged\s+offer|pricing\s+tiers?)\b/i.test(expected)) {
    return false
  }
  void actual
  return true
}

function withStepEvidence(f: JourneyFindingDraft): JourneyFindingDraft {
  if (/reproduced at step/i.test(f.evidence)) return f
  return {
    ...f,
    evidence: `${f.findingType ? 'Reviewed' : 'Reproduced'} at step ${f.stepNumber}. ${f.evidence}`,
  }
}

export function convertEvaluationToFindings(
  evaluation: JourneyEvaluation,
  steps: JourneyStepDraft[],
  startUrl: string,
  purpose: PagePurpose | null = null
): JourneyFindingDraft[] {
  const findings: JourneyFindingDraft[] = []

  for (const fp of evaluation.frictionPoints) {
    const step = steps.find((s) => s.stepNumber === fp.stepNumber)
    findings.push({
      checkId: `journey-funnel-${fp.type}`,
      stepNumber: fp.stepNumber,
      url: step?.url ?? startUrl,
      rubric: fp.rubric,
      severity: fp.severity,
      impactTag: fp.impactTag,
      problem: fp.description,
      evidence: fp.evidence,
      whyItMatters:
        fp.type === 'hesitation'
          ? 'Review the recorded step for unclear choices or missing context.'
          : fp.type === 'confusion'
            ? 'Review whether the next action is clear at this step.'
            : fp.type === 'too-many-steps'
              ? 'Review whether each observed step is needed to complete this task.'
              : fp.type === 'unclear-progress'
                ? 'A visible progress indicator can help explain the remaining steps.'
                : 'Missing feedback after actions makes visitors uncertain whether anything happened.',
      fix: frictionFix(fp),
      screenshotUrl: step?.screenshotAfterUrl,
      accessibilityEvidence: step?.accessibilityTree?.slice(0, 2000),
      confidence: evaluation.confidence,
      findingType: 'friction',
    })
  }

  for (const bp of evaluation.brokenPromises) {
    if (!shouldKeepBrokenPromise(bp.expected, bp.actual, purpose)) continue
    const step = steps.find((s) => s.stepNumber === bp.stepNumber)
    findings.push({
      checkId: 'journey-funnel-broken-promise',
      stepNumber: bp.stepNumber,
      url: step?.url ?? startUrl,
      rubric: 'MESSAGE',
      severity: bp.severity,
      impactTag: 'TRUST',
      problem: `Broken promise: expected "${bp.expected}" but got "${bp.actual}"`,
      evidence: bp.evidence,
      whyItMatters: 'Review the observed difference between the action promise and its destination.',
      fix: '1. Align page content with what was promised in the previous step\n2. Ensure headlines, CTAs, and page content tell a consistent story\n3. Remove misleading claims',
      screenshotUrl: step?.screenshotAfterUrl,
      accessibilityEvidence: step?.accessibilityTree?.slice(0, 2000),
      confidence: evaluation.confidence,
      findingType: 'broken-promise',
    })
  }

  for (const ab of evaluation.accessibilityBarriers) {
    const step = steps.find((s) => s.stepNumber === ab.stepNumber)
    findings.push({
      checkId: 'journey-funnel-accessibility-barrier',
      stepNumber: ab.stepNumber,
      url: step?.url ?? startUrl,
      rubric: 'EXPERIENCE',
      severity: 'IMPORTANT',
      impactTag: 'ACCESSIBILITY',
      problem: ab.barrier,
      evidence: ab.evidence,
      whyItMatters: 'Accessibility barriers stop some people from using this page.',
      fix: accessibilityBarrierFix(ab),
      screenshotUrl: step?.screenshotAfterUrl,
      accessibilityEvidence: step?.accessibilityTree?.slice(0, 2000),
      confidence: evaluation.confidence,
      findingType: 'accessibility-barrier',
    })
  }

  return findings
}

/** Equivalent measured checks can share an action while their observations remain recorded. */
export function omitRepeatedCustomerFindings<T extends { checkId?: string | null; problem: string; evidence?: string; url: string }>(
  existing: Array<{ checkId?: string | null; problem: string; evidence?: string; pageUrl: string | null }>,
  incoming: T[],
): T[] {
  const seen = new Set(existing.map(journeyFindingIdentity))
  return incoming.filter(finding => {
    const key = journeyFindingIdentity(finding)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/** Interpret recorded walk facts before the persistence command records them. */
export function prepareJourneyFindings(result: JourneyFindingFacts, allowedCheckIds?: readonly string[]): JourneyFindingDraft[] {
  const filteredFindings = filterToolingPathFlags(result.findings.map(withStepEvidence)).filter(finding => !allowedCheckIds || allowedCheckIds.includes(baseCheckId(finding.checkId)!) || projectedJourneyFinding(finding) && allowedCheckIds.includes(durableCheckId(finding.checkId)!))
  const networkFlags = runNetworkEngagementChecks([], result.formProbe)
  for (const nf of networkFlags) {
    if (allowedCheckIds && !allowedCheckIds.includes(nf.checkId)) continue
    filteredFindings.push(
      withStepEvidence({
        checkId: nf.checkId,
        stepNumber: result.steps.length || 1,
        url: result.startUrl,
        rubric: 'EXPERIENCE',
        severity: nf.severity as JourneyFindingDraft['severity'],
        impactTag: (nf.impactTag ?? 'CONVERSION') as JourneyFindingDraft['impactTag'],
        problem: nf.problem,
        evidence: nf.evidence,
        whyItMatters: 'The recorded response did not complete the requested action.',
        fix: nf.fix,
        confidence: nf.confidence,
      })
    )
  }

  return filteredFindings
}
