import type { CaptureMetrics } from '../capture-metrics'
import { DeterministicFlag } from './index'

export function runInteractionChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
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
      fix: 'Hide skeletons and spinners once content loads. Use a short loading state, then swap to real hero copy and CTAs.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (metrics.motionIgnoresReducedPreference) {
    const label = metrics.motionSampleLabel ? `"${metrics.motionSampleLabel}"` : 'animated element'
    findings.push({
      checkId: 'motion-ignores-reduced-preference',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Page animations ignore prefers-reduced-motion',
      evidence: `CSS animations on ${label} still run when the browser requests reduced motion.`,
      fix: 'Wrap motion in @media (prefers-reduced-motion: no-preference) or add motion-reduce:animate-none (Tailwind). Respect reduce for infinite loops and hero fades.',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (metrics.inputsBelow16px.length > 0) {
    const sample = metrics.inputsBelow16px
      .slice(0, 3)
      .map((i) => `${i.selector} (${i.fontSize}px)`)
      .join('; ')
    findings.push({
      checkId: 'form-inputs-zoom-mobile',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${metrics.inputsBelow16px.length} form input${metrics.inputsBelow16px.length > 1 ? 's' : ''} trigger iOS zoom on focus`,
      evidence: `Mobile inputs below 16px font-size: ${sample}`,
      fix: 'Set font-size to at least 16px on all form inputs and textareas to prevent iOS Safari from zooming the viewport on focus.',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
