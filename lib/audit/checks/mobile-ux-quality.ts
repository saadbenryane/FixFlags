import type { CaptureMetrics } from '../capture-metrics'
import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from './index'

export function runMobileUXQualityChecks(
  meta: PageMetadata,
  captureMetrics: CaptureMetrics | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const hasViewportMeta = meta.viewport !== null
  if (!hasViewportMeta) {
    findings.push({
      checkId: 'mobile-no-viewport',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'CRITICAL',
      problem: 'Mobile viewport meta tag is missing',
      evidence: 'No <meta name="viewport" content="width=device-width, initial-scale=1"> found. Mobile devices will render the page at desktop width, making text tiny.',
      fix: '1. Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head>\n2. Do not set user-scalable=no (prevents accessibility zoom)\n3. Verify the page renders properly at 375px width after adding the tag',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

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
    const ctaPositionRatio = primaryCtaTop / viewportHeight
    const thumbZoneThreshold = 0.7

    if (ctaPositionRatio > thumbZoneThreshold && ctaPositionRatio <= 1.0) {
      findings.push({
        checkId: 'mobile-cta-thumb-zone',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'POLISH',
        problem: 'Primary CTA is in the hard-to-reach upper zone on mobile',
        evidence: `CTA "${captureMetrics.mobilePrimaryCtaText ?? 'Primary CTA'}" appears at ${Math.round(ctaPositionRatio * 100)}% of the viewport height. Users may need to stretch to tap it one-handed.`,
        fix: '1. Move the primary CTA lower in the mobile viewport (40-70% from top) for thumb-friendly reach\n2. Or ensure the CTA is large enough (min 48px height) to tap easily even when reaching\n3. Consider a sticky bottom CTA that stays within thumb range\n4. Test one-handed on a 6.7" phone - can you tap the CTA comfortably?',
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (captureMetrics.mobilePrimaryCtaText) {
      const ctaText = captureMetrics.mobilePrimaryCtaText.toLowerCase()
      const weakPhrases = ['click here', 'learn more', 'read more', 'submit', 'go', 'start', 'try']

      if (weakPhrases.some((p) => ctaText === p || ctaText.startsWith(p))) {
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

  if (captureMetrics.stuckLoadingIndicator) {
    const label = captureMetrics.stuckLoadingLabel
      ? `"${captureMetrics.stuckLoadingLabel}"`
      : 'loading UI'
    findings.push({
      checkId: 'mobile-stuck-loading',
      rubric: 'EXPERIENCE',
      impactTag: 'CONVERSION',
      severity: 'IMPORTANT',
      problem: 'Loading UI remains visible on mobile after page is ready',
      evidence: `${label} visible at capture time. On mobile, persistent loading states are especially frustrating because users can't see the content they came for.`,
      fix: '1. Hide all loading states once the network request completes\n2. Use transition: opacity to fade out skeletons smoothly\n3. Make sure loading states timeout after max 5 seconds\n4. Show actual content progressively rather than blocking with full-page spinners\n5. Test on slow 3G to verify loading states clear properly',
      confidence: 0.9,
      source: 'DETERMINISTIC',
    })
  }

  if (captureMetrics.loadExperience?.loadingClearedMs != null && captureMetrics.loadExperience.loadingClearedMs > 4000) {
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
