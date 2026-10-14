import { z } from 'zod'
import type { LoadingObservation } from '../browser/loading-ui'
import { captureObservationKey, captureObservationScopeSchema } from '../browser/observation-scope'
import type { CaptureMetrics, PageLoadExperience } from '../capture-metrics'
import type { CheckAssertion } from './assertion'
import type { DeterministicFlag } from '../flag-types'

export const LOADING_VERIFICATION_RULE = 'Loading UI observation v1'
export const LOADING_CHECKS = ['loading-indicator-stuck', 'loading-state-slow', 'mobile-load-delay-content'] as const
const observationSchema = z.object({ version: z.literal(1), device: z.enum(['desktop', 'mobile']), scope: captureObservationScopeSchema,
  contentVisible: z.boolean(), ready: z.boolean(), restricted: z.boolean() }).strict()

export function loadingContext(value: LoadingObservation | undefined): string | undefined {
  const observation = observationSchema.safeParse(value)
  if (!observation.success || observation.data.restricted) return undefined
  const key = captureObservationKey(observation.data.scope)
  return key === 'unknown' ? undefined : 'loading:' + observation.data.device + ':' + key
}
export function loadingDelayObservation(window: PageLoadExperience, threshold: number, key = 'loading-delay'): CheckAssertion {
  const context = window.observation?.device === window.device ? loadingContext(window.observation) : undefined
  const failed = window.loadingVisibleAtInitial && !window.loadingVisibleAtFinal && window.loadingClearedMs !== null && window.loadingClearedMs > threshold
  const passed = !window.loadingVisibleAtFinal && (!window.loadingVisibleAtInitial || window.loadingClearedMs !== null && window.loadingClearedMs <= threshold)
  const comparablePass = passed && window.observation?.ready === true && window.observation.contentVisible === true
  return { key, name: 'Initial loading UI (' + window.device + ')', expected: `Blocking initial loading UI clears within ${threshold}ms and page content is visible`,
    observed: `${window.device}: initial loading ${window.loadingVisibleAtInitial}, final loading ${window.loadingVisibleAtFinal}, cleared at ${window.loadingClearedMs ?? 'unknown'}ms. ` +
      (window.observation?.contentVisible ? 'Viewport content was observed.' : 'Viewport content is unproven.'),
    passed: Boolean(context && comparablePass), complete: Boolean(context && (failed || comparablePass)),
    ...(context ? { context } : window.observation ? {} : { disposition: 'observed' as const }) }
}
export function blockingLoadingObservation(metrics: CaptureMetrics | null): CheckAssertion {
  const context = loadingContext(metrics?.loadingObservation)
  const failed = metrics?.stuckLoadingIndicator === true
  const passed = metrics?.stuckLoadingIndicator === false && metrics.loadingObservation?.ready === true && metrics.loadingObservation.contentVisible === true
  return { key: 'blocking-loading-ui', name: 'Captured loading UI', expected: 'Blocking mobile loading UI is absent and page content is visible',
    observed: metrics ? `Blocking loading UI ${failed ? 'remained' : 'was absent'} at capture time. ` +
      (metrics.loadingObservation?.contentVisible ? 'Viewport content was observed.' : 'Viewport content is unproven.') : 'Loading UI was not observed.',
    passed: Boolean(context && passed), complete: Boolean(context && (failed || passed)),
    ...(context ? { context } : metrics?.loadingObservation ? {} : { disposition: 'observed' as const }) }
}
export function scopeLoadingFlag(flag: DeterministicFlag, observations: Array<LoadingObservation | undefined>): DeterministicFlag {
  const contexts = observations.map(observation => ({ observation, context: loadingContext(observation) }))
  if (!contexts.length || contexts.some(item => !item.context)) return flag
  return { ...flag, verificationRule: LOADING_VERIFICATION_RULE, evidenceTargets: contexts.map(({ observation, context }) => ({
    kind: 'page', source: 'measured', device: observation!.device, label: 'Recorded loading condition', context: context!,
  })) }
}

export function mobileLoadingDelayFlag(load: PageLoadExperience | null | undefined): DeterministicFlag | null {
  if (load?.device === 'mobile' && load.observation?.restricted !== true && load.loadingVisibleAtInitial &&
    load.loadingClearedMs != null && load.loadingClearedMs > 4000) {
    const seconds = (load.loadingClearedMs / 1000).toFixed(1)
    return scopeLoadingFlag({
      checkId: 'mobile-load-delay-content',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `Content is blocked by loading UI for ${seconds}s on mobile`,
      evidence: `Loading UI cleared after ${seconds}s on mobile. On cellular connections, users may leave before content becomes usable.`,
      fix: '1. Server-render hero content so it is available immediately without JS\n2. Inline critical CSS and defer non-critical styles\n3. Use streaming HTML to show content progressively\n4. Target under 2s to first meaningful paint on mobile 3G\n5. Avoid full-page loading states - only show skeletons for slow-loading sections',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    }, [load.observation])
  }

  return null
}
