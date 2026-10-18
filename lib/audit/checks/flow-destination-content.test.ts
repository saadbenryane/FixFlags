import { describe, expect, it } from 'vitest'
import { destinationContentObservations, destinationContentActionContext, DESTINATION_CONTENT_VERIFICATION_RULE } from './flow-destination-content'
import { runFlowChecks } from './flow'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import type { PrimaryActionEvidence } from '../flow/primary-action-evidence'
import type { DestinationUXQuality } from '../flow/destination-ux-probes'
import type { FlowScanResult } from '../flow/run-flow-scan'

const pageUrl = 'https://example.com/signup'
const action: PrimaryActionEvidence = { version: 1, pageContext: 'flow:page:' + 'a'.repeat(64), controlContext: 'flow:control:' + 'b'.repeat(64),
  candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', responseExpected: true, response: 'healthy', httpStatus: 200 }
function ux(overrides: Partial<DestinationUXQuality> = {}): DestinationUXQuality {
  return {
    contentComplete: true, controlsComplete: true, hasClearHeadline: true, hasPrimaryCTA: true, ctaText: 'Continue', ctaPromisesMatch: true,
    headline: 'Start the useful service', pageType: null, visibleCtaCount: 1, actionableCtaCount: 1, primaryCtaHref: '/next',
    trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true },
    mobileReadiness: { hasViewportMeta: true, tapTargetsSmall: false },
    frictionSignals: { ctaCount: 1, distinctCtaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false },
    loadQuality: { hadStuckLoading: false, timeToContentMs: 100, layoutShift: false }, ...overrides,
    trustSignals: { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true, ...overrides.trustSignals },
    frictionSignals: { ctaCount: 1, distinctCtaCount: 1, tooManyCTAs: false, hasDeadEnd: false, formRequiredForValue: false, ...overrides.frictionSignals },
  }
}
function scan(destination: DestinationUXQuality, evidence = action, finalUrl = pageUrl): FlowScanResult {
  return { status: 'success', steps: [], finalUrl, ctaText: 'Get started', destinationUX: destination, actionEvidence: evidence }
}
function receipt(destination: DestinationUXQuality, evidence = action, finalUrl = pageUrl) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'flow', pageUrl: 'https://example.com/', applicable: true,
    complete: true, passed: false, assertions: destinationContentObservations(scan(destination, evidence, finalUrl)),
    execution: { auditId: 'after', taskId: 'flow-task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}

describe('destination content recovery', () => {
  it('certifies a restored headline only for the original control and reached URL', () => {
    const flags = runFlowChecks(scan(ux({ hasClearHeadline: false, headline: null })))
    const flag = flags.find(item => item.checkId === 'flow-destination-no-headline')!
    expect(flag.verificationRule).toBe(DESTINATION_CONTENT_VERIFICATION_RULE)
    expect(destinationContentActionContext(flag.evidenceTargets?.[0])).toBe(action.controlContext)
    const input = { receipt: receipt(ux()), flag, checkId: flag.checkId }
    expect(scopedAssertionForTarget(input)?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(ux({ hasClearHeadline: false, headline: null })) })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(ux(), { ...action, controlContext: 'flow:control:' + 'c'.repeat(64) }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(ux(), action, pageUrl + '/other') })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: { ...flag, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target, device: 'mobile' as const })) } })).toBeUndefined()
  })

  it('does not certify unfinished content, a different next action, or an unscoped promise', () => {
    const unfinished = runFlowChecks(scan(ux({ contentComplete: false, hasClearHeadline: false, headline: null })))
    expect(unfinished.some(flag => flag.checkId === 'flow-destination-no-headline')).toBe(false)
    expect(destinationContentObservations(scan(ux({ contentComplete: false, hasClearHeadline: false, headline: null }))).find(item => item.key === 'destination-headline')?.complete).toBe(false)
    const missingAction = runFlowChecks(scan(ux({ hasPrimaryCTA: false, primaryCtaHref: null, ctaText: null, frictionSignals: { ctaCount: 0, distinctCtaCount: 0, tooManyCTAs: false, hasDeadEnd: true, formRequiredForValue: false } })))
    const next = missingAction.find(flag => flag.checkId === 'flow-destination-no-cta')!
    expect(scopedAssertionForTarget({ receipt: receipt(ux()), flag: next, checkId: next.checkId })?.assertion.passed).toBe(true)
    const mismatch = runFlowChecks({ ...scan(ux({ ctaPromisesMatch: false, headline: 'Unrelated offer' })), actionEvidence: undefined })
    const promise = mismatch.find(flag => flag.checkId === 'flow-cta-message-mismatch')!
    expect(promise.verificationRule).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(ux()), flag: promise, checkId: promise.checkId })).toBeUndefined()
  })
})
