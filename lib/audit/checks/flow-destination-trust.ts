import { createHash } from 'node:crypto'
import { z } from 'zod'
import type { FlowScanResult } from '../flow/run-flow-scan'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'

export const DESTINATION_TRUST_VERIFICATION_RULE = 'Public destination trust v1: independently replay the original control and reached URL under the same capture and access conditions; missing, changed or unavailable scope cannot establish repair.'
export const DESTINATION_TRUST_CONTEXT = /^flow:trust:v1:([a-f0-9]{64}):[a-f0-9]{64}$/
export const destinationTrustTargetSchema = z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('desktop'),
  context: z.string().regex(DESTINATION_TRUST_CONTEXT) }).passthrough()

export function destinationTrustActionContext(value: unknown) {
  const target = destinationTrustTargetSchema.safeParse(value)
  return target.success ? 'flow:control:' + DESTINATION_TRUST_CONTEXT.exec(target.data.context)![1] : undefined
}

function missingTrust(trust: NonNullable<FlowScanResult['destinationTrust']>) {
  const missing: string[] = []
  if (!trust.isHttps) missing.push('HTTPS')
  if (trust.hasPrivacyPolicy === false) missing.push('privacy policy link')
  if (trust.hasContactInfo === false) missing.push('contact information')
  return missing
}

/** Same clicked control and reached URL. A different control, URL, or unhealthy response is a different observation. */
export function comparableDestinationContext(result: Pick<FlowScanResult, 'status' | 'finalUrl' | 'actionEvidence'>, prefix: 'flow:trust:v1' | 'flow:destination:v1', detector?: string) {
  const action = result.actionEvidence
  const control = action?.controlContext?.match(/^flow:control:([a-f0-9]{64})$/)?.[1]
  if (result.status !== 'success' || !result.finalUrl || !control || !action?.clicked || action.clickBlocked ||
    action.navigation !== 'changed' || !action.responseExpected || action.response !== 'healthy') return undefined
  return `${prefix}:${control}:${createHash('sha256').update(detector ? JSON.stringify([result.finalUrl, detector]) : result.finalUrl).digest('hex')}`
}

/** Trust signals are recorded even when nothing is wrong. Silence is not a pass. */
export function destinationTrustObservations(result: Pick<FlowScanResult, 'status' | 'finalUrl' | 'destinationTrust' | 'actionEvidence'>): CheckAssertion[] {
  const trust = result.status === 'success' ? result.destinationTrust : undefined
  const context = comparableDestinationContext(result, 'flow:trust:v1')
  if (!trust) return [{ key: 'destination-trust', name: 'Destination trust signals',
    expected: 'The reached public destination records HTTPS, a privacy link, and contact information',
    observed: result.status !== 'success' ? 'The action did not finish at a successful destination, so trust signals were not assessed.' : 'Destination trust signals were not recorded.',
    passed: false, complete: false, ...(context ? { context } : {}) }]
  const missing = missingTrust(trust)
  const unknown = trust.hasPrivacyPolicy === null || trust.hasContactInfo === null
  return [{ key: 'destination-trust', name: 'Destination trust signals',
    expected: 'The reached public destination records HTTPS, a privacy link, and contact information',
    observed: missing.length ? `After the action, ${result.finalUrl} is missing: ${missing.join(', ')}.`
      : unknown ? `A trust signal at ${result.finalUrl} was not conclusively recorded.`
      : `HTTPS, a privacy link, and contact information were recorded at ${result.finalUrl}.`,
    passed: missing.length === 0 && !unknown, complete: missing.length > 0 || !unknown, ...(context ? { context } : {}) }]
}

export function runDestinationTrustChecks(result: FlowScanResult): DeterministicFlag[] {
  const trust = result.destinationTrust
  const observation = destinationTrustObservations(result)[0]
  if (!trust || !observation || observation.complete === false || observation.passed) return []
  const missing = missingTrust(trust)
  const scoped = observation.context && observation.disposition !== 'observed'

  return [
    {
      checkId: 'flow-cta-destination-no-trust',
      rubric: 'REACH',
      impactTag: 'TRUST',
      severity: 'IMPORTANT',
      problem: 'CTA destination page lacks trust signals',
      evidence: `After clicking the primary CTA, the destination at ${result.finalUrl} is missing: ${missing.join(', ')}.`,
      fix: '1. Add a privacy policy link on signup/checkout pages\n2. Add contact information (email or form) on the destination page\n3. Ensure the destination page uses HTTPS',
      confidence: 0.85,
      source: 'DETERMINISTIC',
      ...(scoped ? { verificationRule: DESTINATION_TRUST_VERIFICATION_RULE, evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const, label: observation.name, context: observation.context }] } : {}),
    },
  ]
}
