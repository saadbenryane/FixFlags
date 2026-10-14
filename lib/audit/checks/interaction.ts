import type { CaptureMetrics, PageLoadExperience } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { recordObservation, type CheckRecorder } from './assertion'
import { blockingLoadingObservation, loadingDelayObservation, scopeLoadingFlag } from './loading-evidence'
import { motionAssertions, scopeMotionFlag } from './motion-evidence'

function slowLoadFlag(load: PageLoadExperience | null | undefined): DeterministicFlag | null {
  if (
    !load?.loadingVisibleAtInitial || load.observation?.restricted === true ||
    load.loadingVisibleAtFinal ||
    load.loadingClearedMs === null ||
    load.loadingClearedMs <= 3_000
  ) {
    return null
  }
  const label = load.loadingLabel ? `"${load.loadingLabel}"` : 'loading UI'
  const seconds = (load.loadingClearedMs / 1000).toFixed(1)
  return {
    checkId: 'loading-state-slow',
    rubric: 'EXPERIENCE',
    impactTag: 'CONVERSION',
    severity: load.loadingClearedMs > 8_000 ? 'CRITICAL' : 'IMPORTANT',
    problem: `Loading state delays usable content for ${seconds}s`,
    evidence: `The initial ${load.device} capture showed ${label}; it cleared after ${seconds}s. Initial screenshot: ${load.initialScreenshotUrl ?? 'not stored'}.`,
    fix: '1. Render the hero headline and primary CTA in the initial HTML\n2. Reserve skeletons for below-the-fold cards instead of covering the first screen\n3. Inline critical CSS and defer non-essential scripts so the first screen becomes usable faster',
    confidence: 0.9,
    source: 'DETERMINISTIC',
  }
}

export function runInteractionChecks(metrics: CaptureMetrics | null, record?: CheckRecorder): DeterministicFlag[] {
  if (metrics?.motionObservation) motionAssertions(metrics.motionObservation).forEach(assertion => record?.(assertion))
  else recordObservation(record, 'reduced-motion', 'Reduced-motion behavior',
    'Reduced motion lowers each observed type of significant motion below half its normal count, or no motion remains',
    metrics?.motionComplete === true ? metrics.motionIgnoresReducedPreference ? 'At least half of an observed motion type remained under reduced motion.' : 'The current-state motion comparison met the reduction rule.'
      : 'A complete reduced-motion comparison is unavailable.',
    metrics?.motionComplete === true ? !metrics.motionIgnoresReducedPreference : undefined)
  record?.(blockingLoadingObservation(metrics))
  const windows = [metrics?.loadExperience, metrics?.desktopLoadExperience].filter((window): window is PageLoadExperience => Boolean(window))
  if (windows.length) windows.forEach(window => record?.(loadingDelayObservation(window, 3000)))
  else recordObservation(record, 'loading-delay', 'Recorded loading delay', 'Blocking initial loading UI clears within 3000ms',
    'No initial and final loading window was recorded.', undefined, true)
  if (metrics == null) return []

  const findings: DeterministicFlag[] = []

  if (metrics.stuckLoadingIndicator && metrics.loadingObservation?.restricted !== true) {
    const label = metrics.stuckLoadingLabel ? `"${metrics.stuckLoadingLabel}"` : 'loading UI'
    findings.push(scopeLoadingFlag({
      checkId: 'loading-indicator-stuck',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Loading or skeleton UI is still visible after the page finished loading',
      evidence: `Visible ${label} remained on screen at capture time (skeleton, spinner, or aria-busy).`,
      fix: '1. Hide skeletons and spinners once content loads\n2. Use a short loading state, then swap to real hero copy and CTAs\n3. Test by throttling the network to verify the timing',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    }, [metrics.loadingObservation]))
  }

  const mobileSlow = slowLoadFlag(metrics.loadExperience)
  const desktopSlow = slowLoadFlag(metrics.desktopLoadExperience)
  const slow = mobileSlow ?? desktopSlow
  if (slow) findings.push(scopeLoadingFlag(slow, windows.filter(window => slowLoadFlag(window)).map(window => window.observation)))

  if (metrics.motionIgnoresReducedPreference) {
    const label = metrics.motionSampleLabel ? `"${metrics.motionSampleLabel}"` : 'animated element'
    findings.push(scopeMotionFlag({
      checkId: 'motion-ignores-reduced-preference',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Page motion ignores the reduced-motion preference',
      evidence: metrics.motionObservation ? motionAssertions(metrics.motionObservation).filter(assertion => assertion.complete && !assertion.passed).map(assertion => assertion.observed).join(' ')
        : `Animations on ${label} still run when the browser requests reduced motion.`,
      fix: '1. Disable decorative CSS animations and transitions with prefers-reduced-motion\n2. Check matchMedia before starting Animation API effects\n3. Load the page with reduced motion enabled and confirm the original motion stops without hiding useful content',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    }, metrics.motionObservation))
  }

  return findings
}
