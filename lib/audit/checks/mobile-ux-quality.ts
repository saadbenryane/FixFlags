import type { CaptureMetrics } from '../capture-metrics'
import type { PageMetadata } from '../metadata'
import type { DeterministicFlag } from '../flag-types'
import { needsFirstStep, type PagePurpose } from '../page-purpose'
import { recordObservation, type CheckRecorder } from './assertion'
import { loadingDelayObservation, mobileLoadingDelayFlag } from './loading-evidence'

export function runMobileUXQualityChecks(
  meta: PageMetadata,
  captureMetrics: CaptureMetrics | null,
  purpose: PagePurpose = 'marketing',
  record?: CheckRecorder,
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  // Missing viewport meta tag is already covered by metadata-checks.ts's
  // 'viewport-missing' (same condition, same severity), so don't double-flag it here.
  if (!captureMetrics) {
    for (const [key, name] of [['mobile-input-fonts', 'Mobile input sizing'], ['mobile-cta-position', 'Mobile action position'],
      ['mobile-cta-label', 'Mobile action label'], ['mobile-loading-delay', 'Mobile loading delay']])
      recordObservation(record, key, name, 'Recorded mobile evidence supports this observation', 'Mobile metrics were not collected.', undefined, true)
    return findings
  }

  recordObservation(record, 'mobile-input-fonts', 'Mobile input sizing', 'Sampled visible inputs use at least 16px fonts',
    `${captureMetrics.inputsBelow16px.length} sampled inputs have fonts below 16px. This does not prove runtime validation or keyboard behavior.`,
    captureMetrics.inputsBelow16px.length === 0, true)

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
  const measuredPosition = primaryCtaTop !== null && Number.isFinite(primaryCtaTop) && viewportHeight > 0 &&
    primaryCtaTop >= 0 && primaryCtaTop <= captureMetrics.mobileDocumentHeight
  if (needsFirstStep(purpose)) recordObservation(record, 'mobile-cta-position', 'Mobile action position',
    'The sampled primary action is below the top 20 percent of the initial mobile viewport',
    measuredPosition ? `Action top ${primaryCtaTop}px, scroll ${captureMetrics.mobileScrollY ?? 0}px, viewport ${viewportHeight}px.` : 'No usable primary action position was measured.',
    measuredPosition ? Math.max(0, primaryCtaTop! - (captureMetrics.mobileScrollY ?? 0)) / viewportHeight >= 0.2 : undefined, true)
  const mobileLoad = captureMetrics.loadExperience
  if (mobileLoad?.device === 'mobile') record?.(loadingDelayObservation(mobileLoad, 4000, 'mobile-loading-delay'))
  else recordObservation(record, 'mobile-loading-delay', 'Mobile loading delay', 'Initial blocking mobile loading UI clears within 4000ms',
    'No mobile loading window was recorded.', undefined, true)

  if (needsFirstStep(purpose) && primaryCtaTop !== null && measuredPosition) {
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
      recordObservation(record, 'mobile-cta-label', 'Mobile action label', 'The sampled primary action label does not match a vague-label pattern',
        `Recorded label: ${captureMetrics.mobilePrimaryCtaText}.`, !isVague, true)
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

  if (needsFirstStep(purpose) && (!captureMetrics.mobilePrimaryCtaText || !measuredPosition))
    recordObservation(record, 'mobile-cta-label', 'Mobile action label', 'A measured primary action has a label that can be inspected',
      'A usable primary action label and position were not recorded.', undefined, true)

  const loadingFlag = mobileLoadingDelayFlag(captureMetrics.loadExperience)
  if (loadingFlag) findings.push(loadingFlag)

  return findings
}
