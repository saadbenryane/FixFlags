import { describe, expect, it } from 'vitest'
import { motionAssertions, motionObservationSchema, scopeMotionFlag, type MotionObservation } from './motion-evidence'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import type { DeterministicFlag } from '../flag-types'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'

const pageUrl = 'https://example.com/'
function observation(normal: string[], reduced: string[], family: 'css' | 'transition' | 'script' = 'css'): MotionObservation {
  const targets = (ids: string[]) => ids.map(id => ({ family, selector: '#' + id, label: id, sample: id }))
  const window = { version: 1 as const, pageUrl, complete: true, windowMs: 2000, observedMs: 2200, restricted: false, contentVisible: true }
  return { version: 1, scope: { pageUrl, finalUrl: pageUrl, profile: 'mobile-profile', access: 'public' },
    before: { ...window, reduced: false, targets: targets(normal) }, after: { ...window, reduced: true, targets: targets(reduced) } }
}
function receipt(data: MotionObservation) {
  const assertions = motionAssertions(data)
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'interaction', pageUrl, applicable: true,
    passed: assertions.every(item => item.passed), complete: assertions.every(item => item.complete), assertions,
    execution: { auditId: 'after', taskId: 'motion-check', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}
function source(data = observation(['original'], ['original'])) {
  return scopeMotionFlag({ checkId: 'motion-ignores-reduced-preference' } as DeterministicFlag, data)
}
function compare(data: MotionObservation, flag = source()) {
  return scopedAssertionForTarget({ receipt: receipt(data), checkId: flag.checkId, flag })
}

describe('paired initial reduced-motion evidence', () => {
  it('counts each family separately and preserves the significant-motion reduction threshold', () => {
    expect(motionAssertions(observation(['honored', 'one', 'two'], ['one', 'two']))[0]).toMatchObject({ complete: true, passed: false })
    expect(motionAssertions(observation(['one', 'two', 'three'], ['one']))[0]).toMatchObject({ complete: true, passed: true })
    const data = observation(['original'], ['original'])
    data.before.targets.push(...observation(['script-one', 'script-two', 'script-three'], [], 'script').before.targets)
    expect(motionAssertions(data)[0]).toMatchObject({ complete: true, passed: false })
    expect(motionAssertions(data)[2]).toMatchObject({ complete: true, passed: true })
  })
  it('requires independent comparable observations and positive page content to establish recovery', () => {
    for (const mode of ['partial', 'restricted', 'blank', 'preference', 'url', 'window', 'unknown-access'] as const) {
      const data = observation(['original'], [])
      if (mode === 'partial') data.after.complete = false
      if (mode === 'restricted') data.after.restricted = true
      if (mode === 'blank') data.after.contentVisible = false
      if (mode === 'preference') data.after.reduced = false
      if (mode === 'url') data.after.pageUrl += 'different'
      if (mode === 'window') data.after.windowMs = 1000
      if (mode === 'unknown-access') data.scope.access = 'credentialed:unknown'
      expect(motionAssertions(data).every(item => item.complete === false), mode).toBe(true)
      expect(compare(data), mode).toBeUndefined()
    }
    expect(compare(observation(['original'], []))?.assertion).toMatchObject({ passed: true, complete: true })
    expect(compare(observation([], []))?.assertion.passed).toBe(true)
  })
  it('does not let added honoring animations dilute an unrepaired original animation', () => {
    const padded = observation(['original', 'new-one', 'new-two', 'new-three'], ['original'])
    expect(receipt(padded).passed).toBe(true)
    expect(compare(padded)?.assertion).toMatchObject({ passed: false, complete: true })
    expect(compare(observation(['original', 'new-one', 'new-two', 'new-three'], ['new-one']))?.assertion.passed).toBe(true)
  })
  it('keeps unrelated remaining motion, changed capture scope and legacy findings incomparable', () => {
    expect(compare(observation(['new-one', 'new-two', 'new-three'], ['new-one']))).toBeUndefined()
    expect(compare(observation(['new-one'], ['new-one']))).toBeUndefined()
    for (const key of ['profile', 'access', 'finalUrl', 'pageUrl'] as const) {
      const data = observation(['original'], [])
      data.scope[key] += key.endsWith('Url') ? 'different' : ':changed'
      expect(compare(data), key).toBeUndefined()
    }
    expect(compare(observation(['original'], []), { ...source(), verificationRule: 'Legacy aggregate motion' })).toBeUndefined()
    expect(motionObservationSchema.safeParse({}).success).toBe(false)
    const unphased = receipt(observation(['original'], []))
    delete unphased.assertions[0].targets![0].context
    expect(scopedAssertionForTarget({ receipt: unphased, checkId: source().checkId, flag: source() })).toBeUndefined()
  })
  it('freezes every originally failing motion family for independent repair verification', () => {
    const original = observation(['original'], ['original'])
    const script = observation(['script'], ['script'], 'script')
    original.before.targets.push(...script.before.targets); original.after.targets.push(...script.after.targets)
    const flag = source(original)
    expect(flag.evidenceTargets).toHaveLength(2)
    expect(compare(observation(['original'], []), flag)?.assertion.passed).toBe(true)
    const partial = observation(['original'], [])
    partial.before.targets.push(...script.before.targets); partial.after.targets.push(...script.after.targets)
    expect(compare(partial, flag)?.assertion.passed).toBe(false)
    const missing = receipt(observation(['original'], []))
    missing.assertions = missing.assertions.filter(item => !item.context?.endsWith(':script'))
    expect(scopedAssertionForTarget({ receipt: missing, checkId: flag.checkId, flag })).toBeUndefined()
  })
  it('shares the source-cohort verdict with Watch recovery instead of trusting a passing page summary', () => {
    const flag = source()
    const input = { auditId: 'after', flag: { ...flag, pageUrl }, executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE',
      targetUrl: pageUrl, environment: 'production', checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null } }
    const recovered = (data: MotionObservation) => hasRecordedRecoveryEvidence({ ...input,
      executions: [{ targetKey: 'module:interaction', status: 'COMPLETED', detail: receipt(data) }] })
    expect(recovered(observation(['original', 'one', 'two', 'three'], ['original']))).toBe(false)
    expect(recovered(observation(['original'], []))).toBe(true)
    const blank = observation([], []); blank.after.contentVisible = false
    expect(recovered(blank)).toBe(false)
  })
})
