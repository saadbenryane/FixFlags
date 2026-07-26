import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'

export function runLayoutChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null || metrics.mobilePrimaryCtaTopPx == null) {
    return []
  }

  // This check promises that the CTA is hidden without scrolling. A CTA whose
  // top edge is inside the initial viewport is visible, even when it sits in
  // the less-comfortable bottom thumb zone (covered separately as POLISH).
  if (metrics.mobilePrimaryCtaTopPx < metrics.mobileViewportHeight) {
    return []
  }

  const ctaLabel = metrics.mobilePrimaryCtaText ? `"${metrics.mobilePrimaryCtaText}"` : 'Primary CTA'
  const scrollDepth = metrics.mobilePrimaryCtaTopPx

  return [
    {
      checkId: 'cta-below-fold-mobile',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: scrollDepth > metrics.mobileViewportHeight ? 'CRITICAL' : 'IMPORTANT',
      problem: 'Primary CTA is hidden below the fold on mobile',
      evidence: `Mobile ${metrics.mobileViewportHeight}px viewport: ${ctaLabel} starts at ${scrollDepth}px scroll depth.`,
      fix: '1. Move the primary CTA above the fold on mobile\n2. Reduce hero image height or collapse the nav\n3. Stack headline + CTA within the first screen (~850px)',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    },
  ]
}
