import type { PostClickMetrics } from '../flow/post-click-probes'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { POST_CLICK_ASSERTIONS } from './definitions'
import type { PrimaryActionEvidence } from '../flow/primary-action-evidence'
import type { FlowScanResult } from '../flow/run-flow-scan'

export const POST_CLICK_VERIFICATION_RULE = 'Public destination loading v2: independently replay the original control and reached URL under the same capture and access conditions; missing, changed or unavailable scope cannot establish repair.'
export const POST_CLICK_CHECKS: readonly string[] = Object.values(POST_CLICK_ASSERTIONS).flat()
export const POST_CLICK_CONTEXT = /^flow:loading:v2:([a-f0-9]{64}):[a-f0-9]{64}$/
export const postClickTargetSchema = z.object({ kind: z.literal('page'), source: z.literal('measured'), device: z.literal('desktop'),
  context: z.string().regex(POST_CLICK_CONTEXT) }).passthrough()
export function postClickActionContext(value: unknown) {
  const target = postClickTargetSchema.safeParse(value)
  return target.success ? 'flow:control:' + POST_CLICK_CONTEXT.exec(target.data.context)![1] : undefined
}

const BLANK_DESTINATION_MS = 3_000
const STUCK_LOADING_MS = 2_000

export function postClickAssertions(metrics: PostClickMetrics | undefined, expectedUrl?: string, action?: PrimaryActionEvidence): CheckAssertion[] {
  if (metrics?.version !== 2) return []
  const samePage = !expectedUrl || metrics.pageUrl === expectedUrl
  const control = action?.controlContext?.match(/^flow:control:([a-f0-9]{64})$/)?.[1]
  const context = samePage && expectedUrl && control && action?.clicked && !action.clickBlocked && action.navigation === 'changed' &&
    action.responseExpected && action.response === 'healthy'
    ? `flow:loading:v2:${control}:${createHash('sha256').update(expectedUrl).digest('hex')}` : undefined
  const scope = context ? { context } : { disposition: 'observed' as const }
  return [{ key: 'destination-content-timing', name: 'Destination content observation',
    expected: 'Meaningful destination content is observed within 3000ms of the click',
    observed: metrics.timeToFirstContentMs === null ? `Content arrival was not observed; absence was established through ${metrics.contentAbsentThroughMs ?? 0}ms.`
      : `Content was first observed at ${metrics.timeToFirstContentMs}ms; absence was established through ${metrics.contentAbsentThroughMs ?? 0}ms.`,
    complete: samePage && metrics.contentComplete === true,
    passed: metrics.timeToFirstContentMs !== null && metrics.timeToFirstContentMs <= BLANK_DESTINATION_MS,
    ...scope },
  { key: 'destination-loading-ui', name: 'Destination loading UI observation',
    expected: 'Blocking loading UI does not persist for 2000ms in the reached viewport',
    observed: metrics.stuckLoading === null ? 'Loading UI could not be conclusively observed.'
      : metrics.stuckLoading ? 'Blocking loading UI persisted across the recorded observation.' : 'No persistent blocking loading UI was recorded.',
    complete: samePage && metrics.loadingComplete === true && (metrics.stuckLoading === true || metrics.timeToFirstContentMs !== null),
    passed: metrics.stuckLoading === false, ...scope }]
}

export function scopePostClickFlags(flags: DeterministicFlag[], result: FlowScanResult) {
  const assertions = postClickAssertions(result.postClickMetrics, result.finalUrl, result.actionEvidence)
  return flags.map(flag => {
    const key = Object.entries(POST_CLICK_ASSERTIONS).find(([, ids]) => ids.some(id => id === flag.checkId))?.[0]
    const observed = assertions.find(assertion => assertion.key === key && assertion.complete && !assertion.passed && assertion.context && assertion.disposition !== 'observed')
    return observed ? { ...flag, verificationRule: POST_CLICK_VERIFICATION_RULE,
      evidenceTargets: [{ kind: 'page' as const, source: 'measured' as const, device: 'desktop' as const, label: observed.name, context: observed.context }] } : flag
  })
}

export function runPostClickFlowChecks(metrics: PostClickMetrics | undefined, expectedUrl?: string): DeterministicFlag[] {
  if (!metrics) return []
  if (metrics.version === 2 && expectedUrl && metrics.pageUrl !== expectedUrl) return []

  const findings: DeterministicFlag[] = []

  if (metrics.version === 2 ? (metrics.contentAbsentThroughMs ?? 0) > BLANK_DESTINATION_MS :
    (metrics.blankScreenMs !== null && metrics.blankScreenMs > BLANK_DESTINATION_MS) ||
    (metrics.timeToFirstContentMs !== null && metrics.timeToFirstContentMs > BLANK_DESTINATION_MS)) {
    findings.push({
      checkId: 'flow-cta-blank-destination',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Primary CTA destination content was delayed',
      evidence: metrics.timeToFirstContentMs === null
        ? `Meaningful destination content was unavailable through ${metrics.contentAbsentThroughMs ?? metrics.blankScreenMs}ms after the click request. No content-arrival time was established.`
        : `Meaningful content was first observed ${metrics.timeToFirstContentMs}ms after the click. The observed content wait after navigation committed was ${metrics.blankScreenMs}ms.`,
      fix: '1. Show hero copy, form, or a loading state within 3 seconds\n2. Avoid long blank screens while JavaScript bundles load\n3. Use server-side rendering or static HTML for the CTA destination',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (metrics.stuckLoading) {
    const label = metrics.stuckLoadingLabel ? `"${metrics.stuckLoadingLabel}"` : 'loading UI'
    findings.push({
      checkId: 'flow-cta-stuck-loading',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Loading or skeleton UI persisted on the CTA destination',
      evidence: `Visible ${label} remained on the destination page for more than ${STUCK_LOADING_MS}ms after navigation.`,
      fix: '1. Hide skeletons and spinners once the destination content loads\n2. Swap loading placeholders for real copy and CTAs\n3. Test with throttled network to verify timing',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
