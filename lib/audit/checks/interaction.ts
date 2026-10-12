import type { CaptureMetrics, PageLoadExperience } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { recordObservation, type CheckRecorder } from './assertion'

function slowLoadFlag(load: PageLoadExperience | null | undefined): DeterministicFlag | null {
  if (
    !load?.loadingVisibleAtInitial ||
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
  recordObservation(record, 'reduced-motion', 'Reduced-motion behavior',
    'Reduced motion lowers the significant visible CSS animation count below half of its original count, or none is initially present',
    metrics?.motionComplete === true ? metrics.motionIgnoresReducedPreference ? 'At least half of the significant CSS motion remained under reduced motion.' : 'The recorded animation-count comparison met the reduction rule.'
      : 'A complete reduced-motion comparison is unavailable.',
    metrics?.motionComplete === true ? !metrics.motionIgnoresReducedPreference : undefined)
  recordObservation(record, 'blocking-loading-ui', 'Captured loading UI',
    'No blocking loading indicator remains at capture time',
    metrics ? `Blocking loading UI ${metrics.stuckLoadingIndicator ? 'remained' : 'was absent'} at capture time.` : 'Loading UI was not observed.',
    metrics && typeof metrics.stuckLoadingIndicator === 'boolean' ? !metrics.stuckLoadingIndicator : undefined, true)
  const windows = [metrics?.loadExperience, metrics?.desktopLoadExperience].filter((window): window is PageLoadExperience => Boolean(window))
  const loadFailed = windows.some(window => Boolean(slowLoadFlag(window)))
  const loadComplete = windows.length > 0 && windows.every(window => !window.loadingVisibleAtFinal &&
    (!window.loadingVisibleAtInitial || window.loadingClearedMs !== null))
  recordObservation(record, 'loading-delay', 'Recorded loading delay', 'Blocking initial loading UI clears within 3000ms in each recorded window',
    windows.length ? windows.map(window => `${window.device}: initial loading ${window.loadingVisibleAtInitial}, final loading ${window.loadingVisibleAtFinal}, cleared at ${window.loadingClearedMs ?? 'unknown'}ms.`).join(' ')
      : 'No initial and final loading window was recorded.', loadFailed ? false : loadComplete ? true : undefined, true)
  if (metrics == null) return []

  const findings: DeterministicFlag[] = []

  if (metrics.stuckLoadingIndicator) {
    const label = metrics.stuckLoadingLabel ? `"${metrics.stuckLoadingLabel}"` : 'loading UI'
    findings.push({
      checkId: 'loading-indicator-stuck',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Loading or skeleton UI is still visible after the page finished loading',
      evidence: `Visible ${label} remained on screen at capture time (skeleton, spinner, or aria-busy).`,
      fix: '1. Hide skeletons and spinners once content loads\n2. Use a short loading state, then swap to real hero copy and CTAs\n3. Test by throttling the network to verify the timing',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  const mobileSlow = slowLoadFlag(metrics.loadExperience)
  const desktopSlow = slowLoadFlag(metrics.desktopLoadExperience)
  const slow = mobileSlow ?? desktopSlow
  if (slow) findings.push(slow)

  if (metrics.motionIgnoresReducedPreference) {
    const label = metrics.motionSampleLabel ? `"${metrics.motionSampleLabel}"` : 'animated element'
    findings.push({
      checkId: 'motion-ignores-reduced-preference',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Page animations ignore prefers-reduced-motion',
      evidence: `CSS animations on ${label} still run when the browser requests reduced motion.`,
      fix: '1. Wrap CSS animations in @media (prefers-reduced-motion: no-preference)\n2. Or add motion-reduce:animate-none (Tailwind utility)\n3. Apply to infinite loops, hero fades, and any decorative motion',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
