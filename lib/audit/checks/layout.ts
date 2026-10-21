import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { needsFirstStep, type PagePurpose } from '../page-purpose'
import { recordObservation, type CheckRecorder } from './assertion'
import { QUALITATIVE_GUIDANCE_COPY as C } from '@/lib/marketing/copy/qualitative-guidance'

export function runLayoutChecks(
  metrics: CaptureMetrics | null,
  purpose: PagePurpose | null = 'marketing',
  record?: CheckRecorder,
): DeterministicFlag[] {
  if (purpose === null) {
    recordObservation(record, 'mobile-cta-position', 'Mobile action position',
      'The page has an applicable conversion purpose', 'Page purpose is unavailable.', undefined, true)
    return []
  }
  // This is a conversion-layout check. A contextual action at the end of an
  // article, documentation page, OSS README, or placeholder is not evidence
  // that the page's primary CTA was hidden. Page-purpose checks already use
  // the same boundary for first-step expectations.
  if (!needsFirstStep(purpose) || metrics == null || metrics.mobilePrimaryCtaTopPx == null) {
    if (needsFirstStep(purpose)) recordObservation(record, 'mobile-cta-position', 'Mobile action position',
      C.actionPositionExpected, 'Action position was not measured.', undefined, true)
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
    scrollDepth < 0 ||
    !Number.isFinite(scrollDepth) ||
    scrollDepth > documentHeight
  ) {
    recordObservation(record, 'mobile-cta-position', 'Mobile action position',
      C.actionPositionExpected, 'The layout measurements are unusable.', undefined, true)
    return []
  }

  recordObservation(record, 'mobile-cta-position', 'Mobile action position',
    C.actionPositionExpected,
    `Action starts at ${scrollDepth}px in a ${viewportHeight}px viewport and ${documentHeight}px document.`, scrollDepth < viewportHeight, true)

  // This check promises that the CTA is hidden without scrolling. A CTA whose
  // top edge is inside the initial viewport is visible, even when it sits in
  // the less-comfortable bottom thumb zone (covered separately as POLISH).
  if (scrollDepth < viewportHeight) {
    return []
  }

  const ctaLabel = metrics.mobilePrimaryCtaText ? `"${metrics.mobilePrimaryCtaText}"` : C.recordedAction

  return [
    {
      checkId: 'cta-below-fold-mobile',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'POLISH',
      problem: C.actionPositionProblem,
      evidence: C.actionPositionEvidence(viewportHeight, ctaLabel, scrollDepth),
      fix: C.actionPosition,
      confidence: 0.95,
      source: 'DETERMINISTIC',
    },
  ]
}
