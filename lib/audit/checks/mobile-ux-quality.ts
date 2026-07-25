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
    const ctaPositionRatio = primaryCtaTop / viewportHeight
    const thumbZoneThreshold = 0.7

    if (ctaPositionRatio > thumbZoneThreshold && ctaPositionRatio <= 1.0) {
      findings.push({
        checkId: 'mobile-cta-thumb-zone',
        rubric: 'EXPERIENCE',
        impactTag: 'CONVERSION',
        severity: 'POLISH',
        problem: 'Primary CTA is in the hard-to-reach bottom zone on mobile',
        evidence: `CTA "${captureMetrics.mobilePrimaryCtaText ?? 'Primary CTA'}" appears at ${Math.round(ctaPositionRatio * 100)}% of the viewport height. Users may need to stretch to tap it one-handed.`,
        fix: '1. Move the primary CTA lower in the mobile viewport (40-70% from top) for thumb-friendly reach\n2. Or ensure the CTA is large enough (min 48px height) to tap easily even when reaching\n3. Consider a sticky bottom CTA that stays within thumb range\n4. Test one-handed on a 6.7" phone - can you tap the CTA comfortably?',
        confidence: 0.7,
        source: 'DETERMINISTIC',
      })
    }

    if (captureMetrics.mobilePrimaryCtaText) {
      const ctaText = captureMetrics.mobilePrimaryCtaText.toLowerCase().trim()
      const weakPhrases = [
        'click here',
        'learn more',
        'read more',
        'submit',
        'go',
        'start',
        'try',
      ]

      const isVague = weakPhrases.some((p) => {
        if (p.includes(' ')) return ctaText.startsWith(p)
        // For single-word phrases, use startsWith to catch variations like
        // "Get started" (matches "start") or "Try free" (matches "try").
        return ctaText.startsWith(p)
      })
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
