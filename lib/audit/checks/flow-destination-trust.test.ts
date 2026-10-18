import { describe, expect, it } from 'vitest'
import { destinationTrustActionContext, destinationTrustObservations, DESTINATION_TRUST_VERIFICATION_RULE, runDestinationTrustChecks } from './flow-destination-trust'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import type { PrimaryActionEvidence } from '../flow/primary-action-evidence'
import type { FlowScanResult } from '../flow/run-flow-scan'

const pageUrl = 'https://example.com/signup'
const action: PrimaryActionEvidence = { version: 1, pageContext: 'flow:page:' + 'a'.repeat(64), controlContext: 'flow:control:' + 'b'.repeat(64),
  candidateCount: 1, clicked: true, clickBlocked: false, navigation: 'changed', responseExpected: true, response: 'healthy', httpStatus: 200 }
const missing = { hasPrivacyPolicy: false, hasContactInfo: true, isHttps: true }
const restored = { hasPrivacyPolicy: true, hasContactInfo: true, isHttps: true }
function scan(trust: FlowScanResult['destinationTrust'], evidence: PrimaryActionEvidence = action, finalUrl = pageUrl): FlowScanResult {
  return { status: 'success', steps: [], finalUrl, destinationTrust: trust, actionEvidence: evidence }
}
function receipt(trust: FlowScanResult['destinationTrust'], evidence = action, finalUrl = pageUrl) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'flow', pageUrl: 'https://example.com/', applicable: true,
    complete: true, passed: false, assertions: destinationTrustObservations(scan(trust, evidence, finalUrl)),
    execution: { auditId: 'after', taskId: 'flow-task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}

describe('destination trust recovery', () => {
  it('binds a missing privacy signal to the original control and certifies only that destination', () => {
    const flags = runDestinationTrustChecks(scan(missing))
    const flag = flags[0]
    expect(flag).toMatchObject({ checkId: 'flow-cta-destination-no-trust', verificationRule: DESTINATION_TRUST_VERIFICATION_RULE })
    expect(destinationTrustActionContext(flag.evidenceTargets?.[0])).toBe(action.controlContext)
    const input = { receipt: receipt(restored), flag, checkId: flag.checkId }
    expect(scopedAssertionForTarget(input)?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(missing) })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(restored, { ...action, controlContext: 'flow:control:' + 'c'.repeat(64) }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(restored, action, pageUrl + '/other') })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipt: receipt(restored, { ...action, response: 'challenge' }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: { ...flag, verificationRule: undefined } })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: { ...flag, evidenceTargets: flag.evidenceTargets!.map(target => ({ ...target, device: 'mobile' as const })) } })).toBeUndefined()
  })

  it('keeps an unknown trust signal incomplete and does not certify an unscoped failure', () => {
    expect(destinationTrustObservations(scan({ hasPrivacyPolicy: null, hasContactInfo: true, isHttps: true }))[0]).toMatchObject({ complete: false, passed: false })
    expect(runDestinationTrustChecks(scan({ hasPrivacyPolicy: null, hasContactInfo: true, isHttps: true }))).toEqual([])
    const unscoped = runDestinationTrustChecks({ status: 'success', steps: [], finalUrl: pageUrl, destinationTrust: missing })
    expect(unscoped[0]?.checkId).toBe('flow-cta-destination-no-trust')
    expect(unscoped[0]?.verificationRule).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(restored), flag: unscoped[0], checkId: unscoped[0].checkId })).toBeUndefined()
    expect(destinationTrustObservations({ status: 'dead_end', steps: [], finalUrl: pageUrl, destinationTrust: missing })[0].complete).toBe(false)
  })
})
