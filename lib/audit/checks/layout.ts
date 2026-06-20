import type { CaptureMetrics } from '../capture-metrics'
import { DeterministicFlag } from './index'

/** Primary CTA should appear within the first ~85% of the mobile viewport without scrolling. */
const MOBILE_FOLD_RATIO = 0.85

export function runLayoutChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null || metrics.mobilePrimaryCtaTopPx == null) {
    return []
  }

  const foldLine = Math.round(metrics.mobileViewportHeight * MOBILE_FOLD_RATIO)
  if (metrics.mobilePrimaryCtaTopPx <= foldLine) {
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
      fix: 'Move the primary CTA above the fold on mobile. Reduce hero image height, collapse nav, and stack headline + CTA within the first screen.',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    },
  ]
}
