import { describe, expect, it } from 'vitest'
import { overlayControlContext, overlayAssertions, runObservedOverlayChecks, preserveUnscopedOverlayFailures, type OverlayObservation } from './overlay-evidence'
import { scopedAssertionForTarget } from './verification'
import { checkReceiptSchema } from './receipt'
import { hasRecordedRecoveryEvidence } from '../recovery-evidence'
import { collapseFlagsWithAffectedPaths } from '../flag-identity'

const pageUrl = 'https://example.com/'
function observation(device: 'desktop' | 'mobile' = 'desktop', disposition: 'passed' | 'failed' | 'unknown' = 'failed'): OverlayObservation {
  const scope = { pageUrl, finalUrl: pageUrl, profile: device + '-profile', access: 'public' }
  return { version: 1, device, scope, complete: true, contentVisible: true, restricted: false,
    controls: [{ kind: 'cta', selector: '#original', label: 'Get started', context: overlayControlContext(scope, 'cta', 'original'), disposition,
      reason: disposition === 'failed' ? 'persistent_overlay' : disposition === 'passed' ? 'clear' : 'unavailable',
      blocker: disposition !== 'failed' ? null : { tag: 'div', id: 'cover', className: 'overlay', role: 'dialog', text: 'Advertisement', zIndex: '100',
        persisted: true, looksLikeOverlay: true, coverageFraction: 1 } }] }
}
function receipt(data: OverlayObservation) {
  const assertions = overlayAssertions(data)
  return checkReceiptSchema.parse({ kind: 'site-module-check', version: 1, module: 'overlays', pageUrl, applicable: true,
    passed: assertions.every(item => item.passed), complete: assertions.every(item => item.complete), assertions,
    execution: { auditId: 'after', taskId: data.device + '-overlays', checkVersion: 1, source: 'rendered-dom', collectedAt: new Date().toISOString() } })
}
describe('source-conditioned overlay evidence', () => {
  it('requires the original interaction phase in addition to an initial clear control', () => {
    const source = observation()
    source.phase = 'primary_action'
    source.controls[0].context = overlayControlContext(source.scope, 'cta', 'original', source.phase)
    const flag = runObservedOverlayChecks(source)[0]
    const initial = receipt(observation('desktop', 'passed'))
    expect(scopedAssertionForTarget({ receipt: initial, checkId: flag.checkId, flag })).toBeUndefined()
    const repaired = { ...source, controls: source.controls.map(control => ({ ...control, disposition: 'passed' as const, blocker: null, reason: 'clear' as const })) }
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: flag.checkId, flag })?.assertion.passed).toBe(true)
    const after = { ...repaired, phase: 'primary_action_after', controls: repaired.controls.map(control => ({ ...control,
      context: overlayControlContext(repaired.scope, control.kind, 'original', 'primary_action_after') })) }
    const afterFlag = runObservedOverlayChecks({ ...after, controls: after.controls.map((control, index) => ({ ...control,
      disposition: 'failed' as const, blocker: source.controls[index].blocker, reason: 'persistent_overlay' as const })) })[0]
    expect(scopedAssertionForTarget({ receipt: receipt(repaired), checkId: afterFlag.checkId, flag: afterFlag })).toBeUndefined()
    expect(scopedAssertionForTarget({ receipt: receipt(after), checkId: afterFlag.checkId, flag: afterFlag })?.assertion.passed).toBe(true)
  })
  it('verifies every original control and device instead of a different clear action', () => {
    const flag = runObservedOverlayChecks(observation())[0]
    flag.evidenceTargets.push(...runObservedOverlayChecks(observation('mobile'))[0].evidenceTargets)
    const healthy = receipt(observation('desktop', 'passed')), partial = receipt(observation('mobile'))
    const compare = (receipts: ReturnType<typeof receipt>[]) => scopedAssertionForTarget({ receipt: healthy, receipts, checkId: flag.checkId, flag })
    expect(compare([healthy, partial])?.assertion.passed).toBe(false)
    expect(compare([healthy])).toBeUndefined()
    expect(compare([healthy, receipt(observation('mobile', 'passed'))])?.assertion.passed).toBe(true)
    const unrelated = observation('mobile', 'passed')
    unrelated.controls[0] = { ...unrelated.controls[0], selector: '#other', label: 'Another action', context: overlayControlContext(unrelated.scope, 'cta', 'other') }
    expect(compare([healthy, receipt(unrelated)])).toBeUndefined()
  })
  it('does not certify hidden, unavailable, blank or changed scope evidence', () => {
    const flag = runObservedOverlayChecks(observation())[0]
    for (const mode of ['blank', 'restricted', 'missing', 'unknown', 'scope'] as const) {
      const data = observation('desktop', 'passed')
      if (mode === 'blank') data.contentVisible = false
      if (mode === 'restricted') data.restricted = true
      if (mode === 'missing') data.controls = []
      if (mode === 'unknown') data.controls[0].disposition = 'unknown'
      if (mode === 'scope') data.controls[0].context = overlayControlContext({ ...data.scope, access: 'changed' }, 'cta', 'original')
      expect(scopedAssertionForTarget({ receipt: receipt(data), checkId: flag.checkId, flag }), mode).toBeUndefined()
    }
    expect(scopedAssertionForTarget({ receipt: receipt(observation('desktop', 'passed')), checkId: flag.checkId,
      flag: { ...flag, verificationRule: 'Legacy unscoped overlay' } })).toBeUndefined()
    for (const field of ['access', 'profile', 'pageUrl', 'finalUrl'] as const) {
      const data = observation('desktop', 'passed')
      data.scope[field] += field.endsWith('Url') ? 'different' : ':changed'
      expect(scopedAssertionForTarget({ receipt: receipt(data), checkId: flag.checkId, flag }), field).toBeUndefined()
    }
  })
  it('shares the same original-control verdict with automatic recovery', () => {
    const flag = runObservedOverlayChecks(observation())[0]
    const recovered = (data: OverlayObservation) => hasRecordedRecoveryEvidence({ auditId: 'after', flag,
      executionSpec: { version: 1, engine: 'progressive-v1', scope: 'SITE', targetUrl: pageUrl, environment: 'production',
        checks: { [flag.checkId]: 1 }, outcomes: [], verificationTarget: null },
      executions: [{ targetKey: 'module:overlays', status: 'COMPLETED', detail: receipt(data) }] })
    expect(recovered(observation())).toBe(false)
    expect(recovered(observation('desktop', 'passed'))).toBe(true)
  })
  it('preserves an unscoped walkthrough failure when combined with a verified initial cohort', () => {
    const initial = runObservedOverlayChecks(observation())[0]
    const walkthrough = { ...initial, verificationRule: 'Legacy walkthrough', evidenceTargets: undefined }
    for (const flags of [[initial, walkthrough], [walkthrough, initial]]) {
      const combined = collapseFlagsWithAffectedPaths(preserveUnscopedOverlayFailures(flags))[0]
      expect(combined.evidenceTargets?.some(target => target.context === 'overlay:unscoped:walkthrough')).toBe(true)
      expect(scopedAssertionForTarget({ receipt: receipt(observation('desktop', 'passed')), checkId: combined.checkId, flag: combined })).toBeUndefined()
    }
  })
})
