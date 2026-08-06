import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'

export function runLayoutChecks(metrics: CaptureMetrics | null): DeterministicFlag[] {
  if (metrics == null || metrics.mobilePrimaryCtaTopPx == null) {
    return []
  }

  const viewportHeight = metrics.mobileViewportHeight
  const documentHeight = metrics.mobileDocumentHeight
  const scrollDepth = metrics.mobilePrimaryCtaTopPx

  // Measurement sanity: a CTA cannot sit below the end of the document, and a
  // zero viewport means the capture was unusable. Skip the check instead of
  // reporting an impossible "scroll depth" (e.g. 10243px on an 812px viewport
  // from a stale/relative measurement).
  if (
    viewportHeight <= 0 ||
    documentHeight <= 0 ||
    scrollDepth > documentHeight
  ) {
    return []
  }

  // This check promises that the CTA is hidden without scrolling. A CTA whose
  // top edge is inside the initial viewport is visible, even when it sits in
  // the less-comfortable bottom thumb zone (covered separately as POLISH).
  if (scrollDepth < viewportHeight) {
    return []
  }

  const ctaLabel = metrics.mobilePrimaryCtaText ? `"${metrics.mobilePrimaryCtaText}"` : 'Primary CTA'

  // CRITICAL only when the CTA sits just below the fold (within ~2 screens).
  // A CTA deep in a long-scroll page is still below the fold but reachable
  // and a deliberate layout choice - IMPORTANT, not a conversion blocker.
  const depthRatio = scrollDepth / viewportHeight
  const severity: 'CRITICAL' | 'IMPORTANT' = depthRatio <= 2 ? 'CRITICAL' : 'IMPORTANT'

  return [
    {
      checkId: 'cta-below-fold-mobile',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity,
      problem: 'Primary CTA is hidden below the fold on mobile',
      evidence: `Mobile ${viewportHeight}px viewport: ${ctaLabel} starts at ${scrollDepth}px scroll depth.`,
      fix: '1. Move the primary CTA above the fold on mobile\n2. Reduce hero image height or collapse the nav\n3. Stack headline + CTA within the first screen (~850px)',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    },
  ]
}
