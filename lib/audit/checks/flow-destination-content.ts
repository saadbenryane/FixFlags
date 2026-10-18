import { z } from 'zod'
import type { FlowScanResult } from '../flow/run-flow-scan'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { DESTINATION_CONTENT_ASSERTIONS } from './definitions'
import { comparableDestinationContext } from './flow-destination-trust'

export const DESTINATION_CONTENT_VERIFICATION_RULE = 'Public destination content v1: independently replay the original control and reached URL under the same capture and access conditions; missing, changed or unavailable scope cannot establish repair.'
export const DESTINATION_CONTENT_CONTEXT = /^flow:destination:v1:([a-f0-9]{64}):[a-f0-9]{64}$/
export const DESTINATION_CONTENT_CHECKS: readonly string[] = Object.values(DESTINATION_CONTENT_ASSERTIONS).flat()
export const destinationContentTargetSchema = z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('desktop'),
  context: z.string().regex(DESTINATION_CONTENT_CONTEXT) }).passthrough()

export function destinationContentActionContext(value: unknown) {
  const target = destinationContentTargetSchema.safeParse(value)
  return target.success ? 'flow:control:' + DESTINATION_CONTENT_CONTEXT.exec(target.data.context)![1] : undefined
}

function observed(key: string, name: string, expected: string, text: string, passed: boolean, complete: boolean, context?: string): CheckAssertion {
  return { key, name, expected, observed: text, passed: complete && passed, complete, ...(context ? { context } : {}) }
}

/** Headline, next action, promise, action count, and form privacy from the reached page. */
export function destinationContentObservations(result: Pick<FlowScanResult, 'status' | 'finalUrl' | 'ctaText' | 'destinationUX' | 'actionEvidence'>): CheckAssertion[] {
  const ux = result.status === 'success' ? result.destinationUX : undefined
  const context = comparableDestinationContext(result, 'flow:destination:v1')
  if (!ux) return [observed('destination-headline', 'Destination headline', 'The reached page has a prominent headline',
    'Destination content was not recorded.', false, false, context)]
  const headline = ux.contentComplete === true
  const controls = ux.controlsComplete === true
  const privacy = ux.trustSignals.hasPrivacyPolicy
  return [
    observed('destination-headline', 'Destination headline', 'The reached page has a prominent headline',
      ux.headline ? `Headline: ${ux.headline}` : 'No prominent headline was recorded.', ux.hasClearHeadline, headline, context),
    observed('destination-next-action', 'Destination next action', 'The reached page offers a next action',
      ux.hasPrimaryCTA || ux.frictionSignals.ctaCount > 0 ? 'A next action was recorded.' : 'No next action was recorded.',
      ux.hasPrimaryCTA || ux.frictionSignals.ctaCount > 0, controls, context),
    observed('destination-promise', 'Destination promise', 'The destination headline agrees with the clicked action',
      ux.headline && result.ctaText ? `Action "${result.ctaText}" reached headline "${ux.headline}".` : 'The action and headline were not both recorded.',
      ux.ctaPromisesMatch, headline && Boolean(ux.headline) && Boolean(result.ctaText), context),
    observed('destination-action-count', 'Destination action count', 'The reached page has one primary action',
      ux.frictionSignals.tooManyCTAs ? `${ux.frictionSignals.distinctCtaCount ?? ux.frictionSignals.ctaCount} competing actions were recorded.` : 'Competing actions were not recorded.',
      !ux.frictionSignals.tooManyCTAs, controls, context),
    observed('destination-form-privacy', 'Destination form privacy', 'A form that asks for information has a privacy link',
      privacy === null ? 'The privacy link was not conclusively recorded.' : privacy === false && ux.frictionSignals.formRequiredForValue ? 'The form has no privacy link.' : 'No missing privacy link was recorded for a form.',
      !(privacy === false && ux.frictionSignals.formRequiredForValue), privacy !== null, context),
  ]
}

export function scopeDestinationContentFlags(flags: DeterministicFlag[], result: FlowScanResult) {
  const assertions = destinationContentObservations(result)
  return flags.map(flag => {
    const key = Object.entries(DESTINATION_CONTENT_ASSERTIONS).find(([, ids]) => (ids as readonly string[]).includes(flag.checkId))?.[0]
    const matched = assertions.find(assertion => assertion.key === key && assertion.complete && !assertion.passed && assertion.context && assertion.disposition !== 'observed')
    return matched ? { ...flag, verificationRule: DESTINATION_CONTENT_VERIFICATION_RULE, evidenceTargets: [{
      kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const, label: matched.name, context: matched.context }] } : flag
  })
}
