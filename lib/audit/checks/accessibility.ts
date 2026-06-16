import { PageMetadata } from '../metadata'
import { PageSpeedResult } from '../pagespeed'
import { DeterministicFlag } from './index'

export function runAccessibilityChecks(
  meta: PageMetadata,
  pagespeed: PageSpeedResult | null
): DeterministicFlag[] {
  const findings: DeterministicFlag[] = []

  if (meta.imagesWithoutAlt > 0) {
    findings.push({
      checkId: 'images-missing-alt',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.imagesWithoutAlt} image${meta.imagesWithoutAlt > 1 ? 's' : ''} missing alt text`,
      evidence: `${meta.imagesWithoutAlt} <img> element${meta.imagesWithoutAlt > 1 ? 's' : ''} found without an alt attribute`,
      fix: 'Add descriptive alt text to all images. For decorative images, use alt="".',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.imagesWithEmptyAlt > 3) {
    findings.push({
      checkId: 'images-empty-alt',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: `${meta.imagesWithEmptyAlt} images have empty alt text`,
      evidence: `${meta.imagesWithEmptyAlt} images with alt=""`,
      fix: 'Review images with empty alt text. Only truly decorative images should have alt="". Informational images need descriptive alt text.',
      confidence: 0.8,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.inputsWithoutLabel > 0) {
    findings.push({
      checkId: 'form-inputs-no-label',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.inputsWithoutLabel} form input${meta.inputsWithoutLabel > 1 ? 's' : ''} without a label`,
      evidence: `${meta.inputsWithoutLabel} input element${meta.inputsWithoutLabel > 1 ? 's' : ''} found without associated <label>, aria-label, or aria-labelledby`,
      fix: 'Add a <label for="inputId"> or aria-label attribute to every form input.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.buttonsWithoutText > 0) {
    findings.push({
      checkId: 'buttons-no-text',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.buttonsWithoutText} button${meta.buttonsWithoutText > 1 ? 's' : ''} without accessible text`,
      evidence: `${meta.buttonsWithoutText} button element${meta.buttonsWithoutText > 1 ? 's' : ''} found without text content or aria-label`,
      fix: 'Add aria-label or visible text to all buttons. Icon-only buttons must have aria-label describing their action.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.linksWithoutText > 0) {
    findings.push({
      checkId: 'links-no-text',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: `${meta.linksWithoutText} link${meta.linksWithoutText > 1 ? 's' : ''} without accessible text`,
      evidence: `${meta.linksWithoutText} <a> element${meta.linksWithoutText > 1 ? 's' : ''} found without text, aria-label, or title`,
      fix: 'Add aria-label or visible text to all links. "Click here" is not sufficient, describe the destination.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.iframesWithoutTitle > 0) {
    findings.push({
      checkId: 'iframe-no-title',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: `${meta.iframesWithoutTitle} iframe${meta.iframesWithoutTitle > 1 ? 's' : ''} without title attribute`,
      evidence: `${meta.iframesWithoutTitle} <iframe> element${meta.iframesWithoutTitle > 1 ? 's' : ''} without title attribute`,
      fix: 'Add a descriptive title attribute to all iframes: <iframe title="Embedded video: ...">',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (meta.positiveTabindex > 0) {
    findings.push({
      checkId: 'tabindex-positive',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: `${meta.positiveTabindex} element${meta.positiveTabindex > 1 ? 's' : ''} with positive tabindex`,
      evidence: `Positive tabindex values found (tabindex="1" or higher)`,
      fix: 'Remove positive tabindex values. Use tabindex="0" to add elements to natural tab order, and tabindex="-1" to remove them.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'color-contrast')) {
    const audit = pagespeed.failedAccessibilityAudits.find((a) => a.id === 'color-contrast')
    findings.push({
      checkId: 'color-contrast-poor',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Text color contrast fails WCAG requirements',
      evidence: `Lighthouse: ${audit?.title ?? 'color-contrast audit failed'}`,
      fix: 'Increase contrast between text and background to at least 4.5:1 for body text and 3:1 for large text.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  const bypassFailed =
    pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'bypass') ?? false
  if ((meta.navLandmarkCount > 0 && !meta.hasSkipLink) || bypassFailed) {
    findings.push({
      checkId: 'skip-link-missing',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: 'No skip-to-content link for keyboard users',
      evidence: bypassFailed
        ? `Lighthouse bypass audit failed; nav landmarks: ${meta.navLandmarkCount}`
        : `Page has ${meta.navLandmarkCount} navigation landmark(s) but no skip link`,
      fix: 'Add a visible-on-focus skip link as the first focusable element: <a href="#main" class="skip-link">Skip to content</a>.',
      confidence: bypassFailed ? 1.0 : 0.85,
      source: 'DETERMINISTIC',
    })
  }

  if (pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'focus-traps')) {
    const audit = pagespeed.failedAccessibilityAudits.find((a) => a.id === 'focus-traps')
    findings.push({
      checkId: 'keyboard-nav-trap',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'IMPORTANT',
      problem: 'Keyboard focus may be trapped in a modal or overlay',
      evidence: `Lighthouse: ${audit?.title ?? 'focus-traps audit failed'}`,
      fix: 'Ensure modals trap focus correctly with Escape to close and restore focus to the trigger element.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  if (pagespeed?.failedAccessibilityAudits.some((a) => a.id === 'focus-visible')) {
    const audit = pagespeed.failedAccessibilityAudits.find((a) => a.id === 'focus-visible')
    findings.push({
      checkId: 'focus-visible-missing',
      rubric: 'EXPERIENCE',
      impactTag: 'ACCESSIBILITY',
      severity: 'POLISH',
      problem: 'Focus indicators are missing or insufficient',
      evidence: `Lighthouse: ${audit?.title ?? 'focus-visible audit failed'}`,
      fix: 'Add visible :focus-visible styles to all interactive elements. Do not remove outline without a replacement.',
      confidence: 1.0,
      source: 'DETERMINISTIC',
    })
  }

  return findings
}
