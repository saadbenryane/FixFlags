import { z } from 'zod'
import { createHash } from 'node:crypto'
import { captureObservationScopeSchema, captureObservationKey, capturePageKey } from '../browser/observation-scope'
import { durableCheckId } from '../flag-identity'
import type { JourneyFindingDraft } from '../journey/types'
import type { CheckAssertion } from './assertion'
import { checkReceiptSchema } from './receipt'

import { JOURNEY_VERIFICATION_RULE, JOURNEY_TYPES, JOURNEY_ASSERTIONS } from './journey-definitions'
export { JOURNEY_VERIFICATION_RULE, JOURNEY_TYPES, JOURNEY_ASSERTIONS } from './journey-definitions'
export const journeyRouteSchema = z.array(z.object({ selector: z.string().min(1).max(2000), label: z.string().max(160) }).strict()).max(1)
export const journeyObservationSchema = z.object({
  version: z.literal(1), journeyType: z.enum(JOURNEY_TYPES), phase: z.enum(['landing', 'destination']),
  scope: captureObservationScopeSchema, route: journeyRouteSchema,
  available: z.boolean(), pathComplete: z.boolean(), headline: z.boolean(), primaryAction: z.boolean(),
  nextPath: z.boolean(), fieldCount: z.number().int().nonnegative(),
  headlineVersion: z.literal(2).optional(), headlineComplete: z.boolean().optional(),
  actionVersion: z.union([z.literal(3), z.literal(4)]).optional(), actionComplete: z.boolean().optional(), pathVersion: z.literal(2).optional(), fieldVersion: z.literal(2).optional(),
}).strict()
export type JourneyObservation = z.infer<typeof journeyObservationSchema>


export function journeyContext(observation: JourneyObservation, condition?: string) {
  const scope = captureObservationKey(observation.scope)
  // Detector corrections cannot certify historical findings as repaired.
  // Unchanged conditions retain their original comparable scope.
  const detector = condition?.endsWith('-action') ? observation.actionVersion ? 'rendered-action-v' + observation.actionVersion : 'primary-action-v2'
    : ['destination-form', 'destination-field-count'].includes(condition ?? '') && observation.fieldVersion === 2 ? 'editable-fields-v2'
    : condition === 'landing-path' && observation.pathVersion === 2 ? 'rendered-path-v2'
    : condition?.endsWith('-headline') && observation.headlineVersion === 2 ? 'rendered-headline-v2' : null
  const key = detector ? createHash('sha256').update(scope + ':' + detector).digest('hex') : scope
  return `journey:${observation.journeyType}:${observation.phase}:${capturePageKey(observation.scope.pageUrl)}:${key}:${JSON.stringify(observation.route)}`
}
export function readJourneyContext(context: string) {
  const matched = /^journey:(first-visit|pricing-evaluation|signup):(landing|destination):([a-f0-9]{64}):([a-f0-9]{64}):(.*)$/.exec(context)
  if (!matched) return undefined
  try {
    const route = journeyRouteSchema.safeParse(JSON.parse(matched[5]))
    return route.success ? { journeyType: matched[1] as typeof JOURNEY_TYPES[number], phase: matched[2] as JourneyObservation['phase'], pageKey: matched[3], route: route.data } : undefined
  } catch { return undefined }
}
export function journeyAssertions(observation: JourneyObservation): CheckAssertion[] {
  const measured = observation.phase === 'landing'
    ? { 'landing-headline': observation.headline, 'landing-action': observation.primaryAction, 'landing-path': observation.nextPath }
    : { 'destination-headline': observation.headline, 'destination-action': observation.primaryAction,
      'destination-form': observation.fieldCount > 0, 'destination-field-count': observation.fieldCount > 0 && observation.fieldCount <= 8 }
  return Object.entries(measured).filter(([key]) => JOURNEY_ASSERTIONS[key as keyof typeof JOURNEY_ASSERTIONS]
    .some(id => id.startsWith('journey-' + observation.journeyType + '-'))).map(([key, passed]) => ({
    key, name: key.replaceAll('-', ' '), expected: 'The recorded page condition is satisfied on the original public journey',
    observed: `${observation.journeyType}, ${observation.phase}: headline ${observation.headline}, action ${observation.primaryAction}, eligible path ${observation.nextPath}, visible fields ${observation.fieldCount}. This does not establish submission success or visitor behaviour.`,
    passed, complete: observation.available && captureObservationKey(observation.scope) !== 'unknown' &&
      (!key.endsWith('-headline') || observation.headlineComplete !== false) &&
      (!key.endsWith('-action') || observation.actionComplete !== false) && (key !== 'landing-path' || observation.pathComplete),
    context: journeyContext(observation, key),
  }))
}
export function scopedJourneyFinding(finding: JourneyFindingDraft, observations: JourneyObservation[]): JourneyFindingDraft | undefined {
  const observed = observations.flatMap(observation => journeyAssertions(observation).map(assertion => ({ observation, assertion })))
    .find(({ observation, assertion }) => observation.scope.finalUrl === finding.url &&
      JOURNEY_ASSERTIONS[assertion.key as keyof typeof JOURNEY_ASSERTIONS].includes(finding.checkId as never))
  if (!observed) return finding
  if (!observed.assertion.complete || observed.assertion.passed) return undefined
  return { ...finding, affectedPaths: [observed.observation.scope.pageUrl], verificationRule: JOURNEY_VERIFICATION_RULE,
    evidenceTargets: [{ kind: 'page', source: 'measured', device: 'desktop', label: observed.assertion.name, context: observed.assertion.context }] }
}
export function journeyReceipts(observations: JourneyObservation[], execution: { auditId: string; taskId: string; collectedAt: string }) {
  return observations.map(observation => checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'journeys',
    pageUrl: observation.scope.pageUrl, applicable: true, passed: journeyAssertions(observation).every(assertion => assertion.passed),
    complete: journeyAssertions(observation).every(assertion => assertion.complete), assertions: journeyAssertions(observation),
    execution: { ...execution, checkVersion: 1, source: 'rendered-dom' } }))
}

export function journeyReceiptScope(receipt: z.infer<typeof checkReceiptSchema>) {
  return ':journey:' + createHash('sha256').update(JSON.stringify(receipt.assertions.map(assertion => assertion.context))).digest('hex')
}

export function nativeJourneyFlags(findings: JourneyFindingDraft[]) {
  return findings.filter(projectedJourneyFinding).map(finding => ({
    checkId: durableCheckId(finding.checkId)!, rubric: finding.rubric, severity: finding.severity, impactTag: finding.impactTag,
    problem: finding.problem, evidence: finding.evidence, fix: finding.fix, confidence: finding.confidence ?? 0.85,
    source: 'DETERMINISTIC' as const, pageUrl: finding.affectedPaths?.[0] ?? finding.url,
    affectedPaths: finding.affectedPaths, evidenceTargets: finding.verificationRule === JOURNEY_VERIFICATION_RULE ? finding.evidenceTargets :
      [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const, label: 'Walkthrough condition without comparable original scope', context: 'journey:unscoped:walkthrough' }],
    verificationRule: JOURNEY_VERIFICATION_RULE,
  }))
}

/** A shared Flag must retain unsupported walkthrough failures alongside native observations. */
export function projectedJourneyFinding(finding: JourneyFindingDraft) {
  return finding.verificationRule === JOURNEY_VERIFICATION_RULE || ['journey-hidden-cta', 'journey-dead-end'].includes(durableCheckId(finding.checkId) ?? '')
}
