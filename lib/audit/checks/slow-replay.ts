import type { SlowReplayResult } from '../flow/slow-replay-probe'
import type { DeterministicFlag } from '../flag-types'
import type { CheckAssertion } from './assertion'
import { slowActionContextSchema, slowReplayCaptureKey, SLOW_REPLAY_PROFILE, SLOW_REPLAY_VERIFICATION_RULE } from '../flow/slow-replay-contract'
import { capturePageKey } from '../browser/observation-scope'

export function slowReplayAssertions(result: SlowReplayResult): CheckAssertion[] {
  if (result.navigationComplete !== true) {
    const observed = 'The slow connection page was not collected. Timing remains unknown.'
    return [
      { key: 'meaningful-text', name: 'Initial content on slow 3G', expected: 'Visible mobile viewport text or decoded main image within 5000ms', observed, passed: false, complete: false },
      { key: 'primary-action-visibility', name: 'Primary action on slow 3G', expected: 'A recognized mobile viewport action within 8000ms', observed, passed: false, complete: false },
    ]
  }
  const captureKey = slowReplayCaptureKey(result)
  const context = captureKey ? 'slow-replay:v2:' + captureKey : SLOW_REPLAY_PROFILE
  const measured = result.profile === SLOW_REPLAY_PROFILE && result.navigationComplete === true && result.reason !== 'interrupted' && !result.restricted
  const contentAt = result.timeToContentMs ?? result.timeToFirstTextMs
  const textPassed = measured && contentAt <= 5000
  const textFailed = measured && (result.contentAbsentThroughMs ?? result.textBlankThroughMs ?? 0) > 5000

  return [
    { key: 'meaningful-text', name: 'Initial content on slow 3G', expected: 'Visible mobile viewport text or decoded main image within 5000ms',
      observed: contentAt < 30_000 ? `Recognized viewport content first observed at ${contentAt}ms.`
        : `Recognized viewport content was not observed through ${result.observedForMs ?? 0}ms.`,
      passed: textPassed, complete: textPassed || textFailed, context },
    ...(result.actions?.length ? result.actions : [{ timeToVisibleMs: result.timeToCtaMs, absentThroughMs: result.ctaAbsentThroughMs ?? 0 }]).map(action => {
      const observed = action.timeToVisibleMs < 30_000
      const passed = measured && action.timeToVisibleMs <= 8000
      const failed = measured && observed && action.absentThroughMs > 8000
      const absent = measured && !observed && action.absentThroughMs > 8000
      const identity = 'selector' in action ? { selector: action.selector, label: action.label, context: action.context } : null
      if (identity && captureKey && result.scope) {
        try {
          const scoped = JSON.stringify({ ...slowActionContextSchema.parse(JSON.parse(identity.context)), captureKey,
            sourcePageKey: capturePageKey(result.scope.pageUrl) })
          if (scoped.length <= 4200) identity.context = scoped
        }
        catch { /* An unscoped historical control cannot acquire native repair identity. */ }
      }
      return { key: 'primary-action-visibility', name: 'Primary action on slow 3G', expected: 'A recognized mobile viewport action within 8000ms',
        observed: observed ? `Recognized action${identity ? ' ' + identity.label : ''} first observed at ${action.timeToVisibleMs}ms.`
          : `The recognized action was not observed through ${result.observedForMs ?? 0}ms. Missing-action detection remains separate.`,
        passed: passed || absent, complete: passed || failed || absent, ...(absent ? { disposition: 'observed' as const } : {}),
        context, ...(identity ? { targets: [identity] } : {}) }
    }),
  ]
}

export function runSlowReplayChecks(result: SlowReplayResult | null): DeterministicFlag[] {
  if (!result) return []
  if (result.profile ? !result.navigationComplete || result.reason === 'interrupted' : result.complete === false) return []

  const findings: DeterministicFlag[] = []

  const observations = result.profile ? slowReplayAssertions(result) : null
  if (observations ? observations[0].complete && !observations[0].passed : result.timeToFirstTextMs > 5_000) {
    const textNeverAppeared = result.timeToFirstTextMs >= 30_000
    findings.push({
      checkId: 'slow-3g-blank-screen',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'CRITICAL',
      problem: 'Page content appears late on slow 3G',
      evidence: observations ? observations[0].observed : textNeverAppeared
        ? 'On simulated 3G, meaningful text was not detected during the recorded observation (threshold 5000ms).'
        : `On simulated 3G, meaningful text appeared after ${result.timeToFirstTextMs}ms (threshold 5000ms).`,
      fix: '1. Reduce JavaScript bundle size with code splitting\n2. Defer non-critical scripts using async or defer\n3. Show static hero HTML before JavaScript hydrates',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  // The legacy absence marker is not an observed duration. A missing action
  // stays separate from a measured delay.
  const delayed = observations ? observations.slice(1).filter(item => item.complete && !item.passed) : []
  if (observations ? delayed.length > 0 : result.timeToCtaMs > 8_000 && result.timeToCtaMs < 30_000) {
    findings.push({
      checkId: 'slow-3g-cta-delayed', rubric: 'EXPERIENCE', impactTag: 'CONVERSION', severity: 'IMPORTANT',
      problem: 'Primary CTA is not visible within 8 seconds on slow 3G',
      evidence: observations ? delayed.map(item => item.observed).join(' ') : `On simulated 3G, the primary CTA became visible after ${result.timeToCtaMs}ms.`,
      fix: '1. Render the primary CTA in the initial server HTML (not JS-dependent)\n2. Inline critical CSS for the hero section including the CTA\n3. Test on simulated 3G to confirm CTA appears before full JS load',
      confidence: 0.85, source: 'DETERMINISTIC',
    })
  }

  return result.profile ? findings.map(flag => ({ ...flag, verificationRule: slowReplayCaptureKey(result) ? SLOW_REPLAY_VERIFICATION_RULE : 'Slow connection observation v1',
    evidenceTargets: flag.checkId === 'slow-3g-cta-delayed' && delayed.some(item => item.targets?.length)
      ? delayed.flatMap(item => item.targets ?? []).map(target => ({ ...target, kind: 'element' as const, source: 'measured' as const, device: 'mobile' as const }))
      : [{ kind: 'page' as const, source: 'measured' as const, device: 'mobile' as const,
        label: flag.checkId === 'slow-3g-blank-screen' ? 'Initial viewport content' : 'Recognized primary action', context: observations?.[0].context ?? result.profile }] })) : findings
}
