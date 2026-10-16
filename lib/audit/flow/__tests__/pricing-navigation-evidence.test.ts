import { describe, expect, it } from 'vitest'
import { pricingNavigationAssertions, type PricingNavigationEvidence } from '../pricing-navigation-evidence'
import { runFlowChecks } from '../../checks/flow'
import { scopedAssertionForTarget } from '../../checks/verification'
import { checkReceiptSchema } from '../../checks/receipt'

const context = 'flow:pricing:v1:' + 'a'.repeat(64)
const evidence: PricingNavigationEvidence = { context, complete: true, passed: false, reason: 'missing-section' }
function flag() {
  return runFlowChecks({ status: 'skipped', steps: [], finalUrl: 'https://example.com/', multiStep: {
    pricingNav: 'broken', pricingNavLabel: 'Pricing', pricingNavHref: '#pricing', pricingEvidence: evidence,
    formValidation: 'skipped', mobileMenu: 'skipped',
  } }).find(flag => flag.checkId === 'flow-pricing-nav-broken')!
}
function receipt(observed: PricingNavigationEvidence) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'flow', pageUrl: 'https://example.com/', applicable: true,
    complete: false, passed: false, assertions: pricingNavigationAssertions(observed), execution: {
      auditId: 'after', taskId: 'pricing-task', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString(),
    } })
}
describe('original pricing navigation evidence', () => {
  it('binds failure and repair to the same rendered control', () => {
    const source = flag(), input = { flag: source, checkId: source.checkId, receipt: receipt(evidence) }
    expect(source.verificationRule).toBeDefined()
    expect(scopedAssertionForTarget(input)?.assertion).toMatchObject({ passed: false, complete: true })
    expect(scopedAssertionForTarget({ ...input, receipt: receipt({ ...evidence, passed: true, reason: 'visible-section' }) })?.assertion.passed).toBe(true)
  })
  it('refuses changed, missing, incomplete, legacy or differently captured scopes', () => {
    const source = flag(), input = { flag: source, checkId: source.checkId, receipt: receipt({ ...evidence, passed: true, reason: 'page-reached' }) }
    for (const reason of ['unavailable', 'unexpected-destination', 'original-missing'] as const)
      expect(scopedAssertionForTarget({ ...input, receipt: receipt({ ...evidence, complete: false, passed: false, reason }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipt: receipt({ ...evidence, context: 'flow:pricing:v1:' + 'b'.repeat(64), passed: true }) })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: { ...source, verificationRule: undefined } })).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, flag: { ...source, evidenceTargets: source.evidenceTargets!.map(target => ({ ...target, device: 'mobile' })) } })).toBeUndefined()
  })
  it('requires every original control before declaring recovery', () => {
    const source = flag(), other = { ...evidence, context: 'flow:pricing:v1:' + 'b'.repeat(64), passed: true, reason: 'page-reached' as const }
    source.evidenceTargets!.push({ ...source.evidenceTargets![0], context: other.context })
    const input = { flag: source, checkId: source.checkId, receipt: receipt({ ...evidence, passed: true }) }
    expect(scopedAssertionForTarget(input)).toBeUndefined()
    expect(scopedAssertionForTarget({ ...input, receipts: [receipt(other)] })?.assertion.passed).toBe(true)
    expect(scopedAssertionForTarget({ ...input, receipts: [receipt({ ...other, passed: false })] })?.assertion.passed).toBe(false)
  })
})
