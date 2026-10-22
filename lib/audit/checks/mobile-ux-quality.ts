import type { CaptureMetrics } from '../capture-metrics'
import type { DeterministicFlag } from '../flag-types'
import { needsFirstStep, type PagePurpose } from '../page-purpose'
import { recordObservation, type CheckRecorder } from './assertion'
import { loadingDelayObservation, mobileLoadingDelayFlag } from './loading-evidence'
import { SITE_ACTION_COPY } from '@/lib/marketing/copy/site-actions'

export function runMobileUXQualityChecks(
  captureMetrics: CaptureMetrics | null,
  purpose: PagePurpose | null = 'marketing',
  record?: CheckRecorder,
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []
  const conversion = purpose !== null && needsFirstStep(purpose)


  // Missing viewport meta tag is already covered by metadata-checks.ts's
  // 'viewport-missing' (same condition, same severity), so don't double-flag it here.
  if (!captureMetrics) {
    for (const [key, name] of [['mobile-input-fonts', 'Mobile input sizing'], ['mobile-cta-position', 'Mobile action position'],
      ['mobile-cta-label', 'Mobile action label'], ['mobile-loading-delay', 'Mobile loading delay']])
      recordObservation(record, key, name, 'Recorded mobile evidence supports this observation', 'Mobile metrics were not collected.', undefined, true)
    return findings
  }

  if (purpose === null) for (const [key, name] of [['mobile-cta-position', 'Mobile action position'], ['mobile-cta-label', 'Mobile action label']])
    recordObservation(record, key, name, 'The page has an applicable conversion purpose', 'Page purpose is unavailable.', undefined, true)

  const fontSamples = captureMetrics.inputFontSamples
  const fontsComplete = Array.isArray(fontSamples) && captureMetrics.inputFontsComplete === true
  const smallInputs = new Set(captureMetrics.inputsBelow16px.map(input => input.selector))
  const groups = fontSamples?.length ? [true, false].flatMap(small => [true, false].flatMap(identified => {
    const inputs = fontSamples.filter(input => smallInputs.has(input.selector) === small &&
      /^mobile-input:[a-f0-9]{64}$/.test(input.context ?? '') === identified)
    return inputs.length ? [{ inputs, small, context: inputs[0].context ?? 'mobile-input:unknown' }] : []
  })) : [{ inputs: [], small: captureMetrics.inputsBelow16px.length > 0, context: undefined }]
  for (const group of groups) {
    const passed = fontsComplete && !group.small
    // A passing 16px sample records CSS sizing and cannot certify recovery.
    record?.({ key: 'mobile-input-fonts', name: SITE_ACTION_COPY.mobileInputs.name,
      expected: SITE_ACTION_COPY.mobileInputs.expected,
      observed: fontsComplete ? SITE_ACTION_COPY.mobileInputs.observed(group.small ? group.inputs.length : 0) : SITE_ACTION_COPY.mobileInputs.limited,
      passed, complete: fontsComplete, ...(passed ? { disposition: 'observed' as const } : {}), context: group.context,
      targets: group.inputs.map(input => ({ selector: input.selector, label: SITE_ACTION_COPY.mobileInputs.reference, context: input.context })) })
  }

  if (captureMetrics.inputsBelow16px.length > 0) {
    findings.push({
      checkId: 'mobile-input-zoom',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: SITE_ACTION_COPY.mobileInputs.problem(captureMetrics.inputsBelow16px.length),
      evidence: SITE_ACTION_COPY.mobileInputs.evidence(captureMetrics.inputsBelow16px.slice(0, 3).map(i => `${i.selector} (${i.fontSize}px)`).join(', ')),
      evidenceTargets: captureMetrics.inputsBelow16px.slice(0, 200).map(input => ({ kind: 'element', source: 'measured', device: 'mobile',
        selector: input.selector, label: SITE_ACTION_COPY.mobileInputs.reference,
        context: fontSamples?.find(sample => sample.selector === input.selector)?.context ?? 'mobile-input:unknown' })),
      fix: SITE_ACTION_COPY.mobileInputs.fix(captureMetrics.inputsBelow16px.slice(0, 3).map(i => i.selector).join(', ')),
      confidence: 0.95,
      source: 'DETERMINISTIC',
    })
  }

  const primaryCtaTop = captureMetrics.mobilePrimaryCtaTopPx
  const viewportHeight = captureMetrics.mobileViewportHeight
  const measuredPosition = primaryCtaTop !== null && Number.isFinite(primaryCtaTop) && viewportHeight > 0 &&
    primaryCtaTop >= 0 && primaryCtaTop <= captureMetrics.mobileDocumentHeight
  if (conversion) recordObservation(record, 'mobile-cta-position', 'Mobile action position',
    'The sampled primary action is below the top 20 percent of the initial mobile viewport',
    measuredPosition ? `Action top ${primaryCtaTop}px, scroll ${captureMetrics.mobileScrollY ?? 0}px, viewport ${viewportHeight}px.` : 'No usable primary action position was measured.',
    measuredPosition ? Math.max(0, primaryCtaTop! - (captureMetrics.mobileScrollY ?? 0)) / viewportHeight >= 0.2 : undefined, true)
  const mobileLoad = captureMetrics.loadExperience
  if (mobileLoad?.device === 'mobile') record?.(loadingDelayObservation(mobileLoad, 4000, 'mobile-loading-delay', true))
  else recordObservation(record, 'mobile-loading-delay', 'Mobile loading delay', 'Initial blocking mobile loading UI clears within 4000ms',
    'No mobile loading window was recorded.', undefined, true)

  if (conversion && primaryCtaTop !== null && measuredPosition) {
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

  if (conversion && (!captureMetrics.mobilePrimaryCtaText || !measuredPosition))
    recordObservation(record, 'mobile-cta-label', 'Mobile action label', 'A measured primary action has a label that can be inspected',
      'A usable primary action label and position were not recorded.', undefined, true)

  const loadingFlag = mobileLoadingDelayFlag(captureMetrics.loadExperience)
  if (loadingFlag) findings.push(loadingFlag)

  return findings
}
