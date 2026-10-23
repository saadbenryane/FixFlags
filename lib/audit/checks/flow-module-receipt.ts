import type { CheckAssertion } from './assertion'
import type { FlowScanResult } from '../flow/run-flow-scan'
import { destinationContentObservations } from './flow-destination-content'
import { destinationTrustObservations } from './flow-destination-trust'
import { postClickAssertions } from './flow-post-click'
import { primaryActionAssertions } from '../flow/primary-action-evidence'
import { pricingNavigationAssertions } from '../flow/pricing-navigation-evidence'

/** Unfinished destination observations stay on the receipt. Dropping them would
 * let the module look complete without a recorded trust or content result. */
export function assembleFlowModuleCheck(input: {
  result: FlowScanResult
  actionRequired: boolean | null
  actionFlags: readonly unknown[]
  pricingOnly: boolean
  targetedPricing: boolean
  protectedActionRefused?: boolean
}) {
  const { result } = input
  const applicable = input.pricingOnly
    ? Boolean(result.multiStep?.pricingEvidence) || input.targetedPricing || result.multiStep?.pricingComplete === false
    : !result.actionEvidence || result.actionEvidence.candidateCount > 0 || input.actionRequired !== false
  const primaryAssertions = primaryActionAssertions(result.actionEvidence, input.actionRequired)
  const trustAssertions = result.destinationTrust ? destinationTrustObservations(result) : []
  const contentAssertions = result.status === 'success' && result.destinationUX ? destinationContentObservations(result) : []
  const assertions: CheckAssertion[] = [...primaryAssertions, ...postClickAssertions(result.postClickMetrics, result.finalUrl, result.actionEvidence),
    ...pricingNavigationAssertions(result.multiStep?.pricingEvidence), ...trustAssertions, ...contentAssertions]
  if (applicable && input.protectedActionRefused) assertions.push({ key: 'public-action-boundary', name: 'Public action coverage',
    expected: 'The action can be inspected without submitting protected data',
    observed: 'A protected action was blocked. The recorded observations remain available; the affected action is unverified.',
    passed: false, complete: false })
  const destinationComplete = !result.destinationUX || result.destinationUX.contentComplete !== false && result.destinationUX.controlsComplete !== false
  const complete = input.pricingOnly
    ? !applicable || assertions.length > 0 && assertions.every(assertion => assertion.complete === true)
    : !applicable || primaryAssertions.length === 4 && destinationComplete && assertions.every(assertion => assertion.complete === true)
  return { applicable, assertions, complete, passed: complete && input.actionFlags.length === 0 && assertions.every(assertion => assertion.passed) }
}
