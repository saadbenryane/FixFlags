import { describe, expect, it } from 'vitest'
import { mobileNavigationAssertions, mobileNavigationFlags, mobileNavigationContext, mobileLinkIdentity, type MobileNavigationObservation } from '../mobile-navigation-evidence'
import { scopedAssertionForTarget } from '../../checks/verification'
import { checkReceiptSchema } from '../../checks/receipt'
import { hasRecordedRecoveryEvidence } from '../../recovery-evidence'

const pageUrl = 'https://example.com/'
function observation(healthy = false): MobileNavigationObservation {
  return { selector: '#main-nav', label: 'Main navigation', complete: true, opened: healthy, reason: 'menu_observed',
    context: mobileNavigationContext({ pageUrl, finalUrl: pageUrl, profile: 'mobile', access: 'public' }, '#main-nav'),
    links: [{ identity: mobileLinkIdentity(pageUrl + 'features', 'Features'), selector: '#features', label: 'Features', reachable: healthy }] }
}
function receipt(data: MobileNavigationObservation) {
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'mobile-navigation', pageUrl, applicable: true,
    complete: data.complete, passed: data.opened, assertions: mobileNavigationAssertions([data]),
    execution: { auditId: 'after', taskId: 'mobile-navigation', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}
const flag = mobileNavigationFlags([observation()], pageUrl)[0]
const compare = (data: MobileNavigationObservation) => scopedAssertionForTarget({ receipt: receipt(data), checkId: flag.checkId, flag })
describe('independent mobile navigation evidence', () => {
  it('checks the original navigation links rather than another visible menu', () => {
    expect(compare(observation())?.assertion.passed).toBe(false)
    expect(compare(observation(true))?.assertion.passed).toBe(true)
    expect(compare({ ...observation(true), links: [] })).toBeUndefined()
    const changed = observation(true)
    changed.links[0].identity = mobileLinkIdentity(pageUrl + 'other', 'Features')
    expect(compare(changed)).toBeUndefined()
    const differentPanel = { ...observation(true), context: mobileNavigationContext({ pageUrl, finalUrl: pageUrl, profile: 'mobile', access: 'public' }, '#other-nav') }
    expect(compare(differentPanel)).toBeUndefined()
  })
  it('requires complete comparable capture conditions and rejects legacy completion', () => {
    expect(compare({ ...observation(true), complete: false })).toBeUndefined()
    for (const field of ['pageUrl', 'finalUrl', 'profile', 'access'] as const) {
      const scope = { pageUrl, finalUrl: pageUrl, profile: 'mobile', access: 'public' }
      scope[field] += ':different'
      expect(compare({ ...observation(true), context: mobileNavigationContext(scope, '#main-nav') }), field).toBeUndefined()
    }
    expect(scopedAssertionForTarget({ receipt: receipt(observation(true)), checkId: flag.checkId, flag: { ...flag, verificationRule: 'Legacy mobile menu' } })).toBeUndefined()
    expect(mobileNavigationFlags([{ ...observation(), complete: false }], pageUrl)).toEqual([])
  })
  it('can verify a formerly empty declared panel when it gains visible navigation links', () => {
    const empty = { ...observation(), links: [] }
    const original = mobileNavigationFlags([empty], pageUrl)[0]
    expect(scopedAssertionForTarget({ receipt: receipt(empty), checkId: original.checkId, flag: original })?.assertion.passed).toBe(false)
    expect(scopedAssertionForTarget({ receipt: receipt(observation(true)), checkId: original.checkId, flag: original })?.assertion.passed).toBe(true)
  })
  it('requires every original page and uses the same conclusion for monitoring recovery', () => {
    const peer = { ...observation(), context: mobileNavigationContext({ pageUrl: pageUrl + 'other', finalUrl: pageUrl + 'other', profile: 'mobile', access: 'public' }, '#main-nav') }
    const combined = { ...flag, evidenceTargets: [...flag.evidenceTargets!, ...mobileNavigationFlags([peer], pageUrl + 'other')[0].evidenceTargets!] }
    const healthy = receipt(observation(true))
    expect(scopedAssertionForTarget({ receipt: healthy, checkId: flag.checkId, flag: combined })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(observation()), checkId: flag.checkId, flag: combined })?.assertion)
      .toMatchObject({ passed: false, complete: true })
    const different = observation()
    different.links[0].identity = mobileLinkIdentity(pageUrl + 'other', 'Another link')
    expect(scopedAssertionForTarget({ receipt: receipt(different), checkId: flag.checkId, flag: combined })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: healthy, receipts: [receipt(peer)], checkId: flag.checkId, flag: combined })?.assertion.passed).toBe(false)
    const recovered = (data: MobileNavigationObservation) => hasRecordedRecoveryEvidence({ auditId: 'after', flag,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl, environment: 'production',
        checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null },
      executions: [{ targetKey: 'module:mobile-navigation', status: 'COMPLETED', detail: receipt(data) }] })
    expect(recovered(observation())).toBe(false)
    expect(recovered(observation(true))).toBe(true)
  })
})
