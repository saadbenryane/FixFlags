import type { CaptureMetrics } from '../capture-metrics'
import { DeterministicFlag } from './index'

export function runInteractionChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null || !metrics.stuckLoadingIndicator) {
    return []
  }

  const label = metrics.stuckLoadingLabel ? `"${metrics.stuckLoadingLabel}"` : 'loading UI'

  return [
    {
      checkId: 'loading-indicator-stuck',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Loading or skeleton UI is still visible after the page finished loading',
      evidence: `Visible ${label} remained on screen at capture time (skeleton, spinner, or aria-busy).`,
      fix: 'Hide skeletons and spinners once content loads. Use a short loading state, then swap to real hero copy and CTAs.',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    },
  ]
}
