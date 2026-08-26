import type { CaptureMetrics } from '../capture-metrics'
import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'

export function runMobileUXQualityChecks(
  meta: PageMetadata,
  captureMetrics: CaptureMetrics | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  // Missing viewport meta tag is already covered by metadata-checks.ts's
  // 'viewport-missing' (same condition, same severity), so don't double-flag it here.
  if (!captureMetrics) return findings

  if (captureMetrics.inputsBelow16px.length > 0) {
    findings.push({
      checkId: 'mobile-input-zoom',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${captureMetrics.inputsBelow16px.length} form input${captureMetrics.inputsBelow16px.length > 1 ? 's' : ''} will trigger iOS zoom on focus`,
      evidence: `Inputs below 16px: ${captureMetrics.inputsBelow16px.slice(0, 3).map((i) => `${i.selector} (${i.fontSize}px)`).join(', ')}. iOS Safari zooms into inputs under 16px, disorienting the user.`,
      fix: '1. Set font-size to 16px minimum on all input, textarea, and select elements\n2. Apply globally: input, textarea, select { font-size: 16px; }\n3. Test on iOS Safari to confirm the viewport no longer zooms on focus\n4. Do not use 15px - only 16px+ prevents the zoom behavior',
      confidence: 0.95,
      source: 'DETERMINISTIC',
    })
  }

  const primaryCtaTop = captureMetrics.mobilePrimaryCtaTopPx
  const viewportHeight = captureMetrics.mobileViewportHeight

  if (primaryCtaTop !== null && viewportHeight > 0) {
    // The metric is an absolute document position; the thumb-zone ratio is
    // about the CTA's position in the initial viewport, so use the
    // viewport-relative top.
    const viewportTop = Math.max(
      0,
      primaryCtaTop - (captureMetrics.mobileScrollY ?? 0)
    )
    const ctaPositionRatio = viewportTop / viewportHeight
    const hardToReachTopThreshold = 0.2

    if (ctaPositionRatio >= 0 && ctaPositionRatio < hardToReachTopThreshold) {
      findings.push({
        checkId: 'mobile-cta-thumb-zone',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'POLISH',
        problem: 'Primary CTA is in the hard-to-reach top zone on mobile',
        evidence: `CTA "${captureMetrics.mobilePrimaryCtaText ?? 'Primary CTA'}" appears at ${Math.round(ctaPositionRatio * 100)}% of the viewport height. The top edge is harder to reach one-handed on larger phones.`,
        fix: '1. Move the primary CTA into the middle or lower mobile viewport (35-75% from top)\n2. Keep the CTA at least 48px tall\n3. Consider a sticky bottom CTA for the primary action\n4. Test one-handed on a 6.7" phone',
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (captureMetrics.mobilePrimaryCtaText) {
      const ctaText = captureMetrics.mobilePrimaryCtaText.toLowerCase().trim()
      // Multi-word weak phrases: match as prefix (e.g. "learn more about..." matches "learn more")
      const weakPhrases = [
        'click here',
        'learn more',
        'read more',
      ]
      // Single-word weak phrases: exact match only. "start" alone is vague,
      // but "Get started" or "Start building" are effective CTAs.
      const weakExactWords = ['submit', 'go']

      const isVague =
        weakPhrases.some((p) => ctaText.startsWith(p)) ||
        weakExactWords.some((p) => ctaText === p)
      if (isVague) {
        findings.push({
          checkId: 'mobile-cta-weak-label',
          rubric: 'MESSAGE',
          impactTag: 'CONVERSION',
          severity: 'POLISH',
          problem: `Mobile CTA label "${captureMetrics.mobilePrimaryCtaText}" is vague`,
          evidence: `Primary mobile CTA reads "${captureMetrics.mobilePrimaryCtaText}". Vague CTAs reduce click-through because users don't know what happens next.`,
          fix: '1. Replace vague CTAs with outcome-specific labels: "Try" → "Try free for 14 days"\n2. Use action + benefit format: "Get started free" not "Learn more"\n3. Add specificity: "Start free trial" rather than just "Start"\n4. Test two CTAs against each other to see which drives more clicks',
          confidence: 0.8,
          source: 'DETERMINISTIC',
        })
      }
    }
  }

  if (captureMetrics.loadExperience?.device === 'mobile' && captureMetrics.loadExperience.loadingClearedMs != null && captureMetrics.loadExperience.loadingClearedMs > 4000) {
    const seconds = (captureMetrics.loadExperience.loadingClearedMs / 1000).toFixed(1)
    findings.push({
      checkId: 'mobile-load-delay-content',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: `Content is blocked by loading UI for ${seconds}s on mobile`,
      evidence: `Loading UI cleared after ${seconds}s on mobile. On cellular connections, users may leave before content becomes usable.`,
      fix: '1. Server-render hero content so it is available immediately without JS\n2. Inline critical CSS and defer non-critical styles\n3. Use streaming HTML to show content progressively\n4. Target under 2s to first meaningful paint on mobile 3G\n5. Avoid full-page loading states - only show skeletons for slow-loading sections',
      confidence: 0.85,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
